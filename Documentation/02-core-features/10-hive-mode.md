# Hive Mode: Multi-Tool Memory Sharing

> **Last Updated**: 2025-10-28

## Overview

**Hive Mode** enables multiple AI tools and agents to share a single memory space, eliminating data duplication and ensuring consistent memory across all participants. This is the perfect model for cross-application AI memory and MCP (Model Context Protocol) integration.

**Think of it like a bee hive:** Multiple bees (tools/agents) working in one hive (memory space), all contributing to and benefiting from shared knowledge.

## Quick Comparison

| Aspect            | Hive Mode              | Collaboration Mode       |
| ----------------- | ---------------------- | ------------------------ |
| **Memory Spaces** | 1 shared space         | N separate spaces        |
| **Storage**       | Single write           | Dual-write (A2A)         |
| **Participants**  | Multiple in same space | Each in own space        |
| **Consistency**   | Always consistent      | Eventually consistent    |
| **Use Case**      | Personal AI tools, MCP | Autonomous agents        |
| **Example**       | Cursor + Claude        | Finance agent + HR agent |

## When to Use Hive Mode

### Perfect For:

✅ **Personal AI Ecosystems**

- Cursor IDE + Claude Desktop + Notion AI
- All tools share your personal knowledge
- One conversation in Cursor, accessible in Claude

✅ **MCP Integration**

- Cross-application memory via Model Context Protocol
- Memory follows you across tools
- Zero configuration for users

✅ **Team Workspaces**

- Multiple bots in a Slack channel
- Shared project knowledge
- Collaborative AI assistants

✅ **Single User, Multiple Interfaces**

- Web app + mobile app + CLI
- Consistent memory everywhere
- No sync required

### NOT Ideal For:

❌ **Autonomous Multi-Agent Systems**

- Use Collaboration Mode instead
- Each agent needs independent memory
- Agents make autonomous decisions

❌ **Strict Compliance Requirements**

- Some regulations require per-agent isolation
- Use Collaboration Mode for audit trails
- When you need separate deletions

❌ **Multi-Tenant SaaS (per customer)**

- Each customer should have separate memory spaces
- Don't mix customer data in one hive
- Use one memorySpace per customer

## Core Concepts

### Memory Space (The Hive)

```typescript
interface MemorySpace {
  id: string; // e.g., "user-123-personal"
  name?: string; // "Alice's Personal Space"
  type: "personal" | "team" | "project";
  participants: string[]; // ["cursor", "claude", "custom-bot"]
  createdAt: Date;
}
```

### Participants (The Bees)

```typescript
interface Participant {
  id: string; // e.g., "cursor", "claude", "my-bot"
  type: "ai-tool" | "human" | "system";
  joinedAt: Date;
}
```

**Key Insight:** `participantId` is OPTIONAL but recommended. It tracks "who stored what" for audit and debugging.

## Setup and Usage

### Option 1: Implicit (Simplest)

Just use the same `memorySpaceId` - space created automatically:

```typescript
// Cursor stores memory
await cortex.memory.remember({
  memorySpaceId: "user-123-personal", // Shared space
  participantId: "cursor", // Optional but recommended
  conversationId: "conv-abc",
  userMessage: "I prefer TypeScript",
  agentResponse: "Noted!",
  userId: "user-123",
  userName: "Alice",
});

// Later, Claude reads from SAME space
const memories = await cortex.memory.search(
  "user-123-personal",
  "programming preferences",
);
// Returns: [{ content: "User prefers TypeScript", participantId: "cursor", ... }]
```

**Benefits:**

- Zero ceremony
- Works immediately
- No registration required

### Option 2: Explicit (Recommended for Production)

Register the memory space with participants:

```typescript
// Register space once
await cortex.memorySpaces.register({
  id: "user-123-personal",
  name: "Alice's Personal AI Memory",
  type: "personal",
  participants: ["cursor", "claude", "notion-ai"],
  metadata: {
    owner: "user-123",
    created: new Date(),
    description: "Shared memory for Alice's AI tools",
  },
});

// Now use it
await cortex.memory.remember({
  memorySpaceId: "user-123-personal",
  participantId: "cursor",
  // ... rest of memory
});
```

**Benefits:**

- Analytics per memory space
- Participant tracking
- Better observability
- Metadata for organization

## Data Flow in Hive Mode

### Single Write, All Benefit

```
┌─────────────────────────────────────────────────────────────┐
│                     User Interaction                         │
│  User tells Cursor: "I prefer dark mode"                    │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│                Cursor (Participant 1)                        │
│  Stores in shared memory space:                             │
│    memorySpaceId: "user-123-personal"                       │
│    participantId: "cursor"                                  │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│              Memory Space: user-123-personal                 │
│  {                                                           │
│    memorySpaceId: "user-123-personal",                      │
│    participantId: "cursor",                                 │
│    content: "User prefers dark mode",                       │
│    ...                                                      │
│  }                                                          │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ├──────────────────┬──────────────────┐
                        ▼                  ▼                  ▼
           ┌────────────────┐  ┌────────────────┐  ┌────────────────┐
           │ Cursor         │  │ Claude         │  │ Notion AI      │
           │ (Participant 1)│  │ (Participant 2)│  │ (Participant 3)│
           │                │  │                │  │                │
           │ Can read ALL   │  │ Can read ALL   │  │ Can read ALL   │
           │ memories in    │  │ memories in    │  │ memories in    │
           │ the space      │  │ the space      │  │ the space      │
           └────────────────┘  └────────────────┘  └────────────────┘
```

**Key Point:** ONE write, THREE readers. Zero duplication!

## Participant Tracking

### Why Track Participants?

```typescript
// Store with participant tracking
await cortex.memory.remember({
  memorySpaceId: "team-engineering",
  participantId: "code-review-bot", // Who stored this
  conversationId: "internal-comm",
  userMessage: "[From deployment-bot] Build ready",
  agentResponse: "Starting code review",
  userId: "system",
  userName: "System",
});

// Later, audit who contributed what
const memories = await cortex.memory.list("team-engineering", {
  participantId: "code-review-bot", // Filter by participant
});

// Or see all participants' activity
const allMemories = await cortex.memory.list("team-engineering");
allMemories.forEach((m) => {
  console.log(`Stored by: ${m.participantId}`);
});
```

**Use Cases:**

- **Debugging:** "Which tool stored this incorrect information?"
- **Analytics:** "Which participant is most active?"
- **Audit Trails:** "Who had access to this data?"
- **Optimization:** "Which tool should we optimize first?"

### Participant-Specific Queries

```typescript
// Get memories from specific participant
const cursorMemories = await cortex.memory.search(
  "user-123-personal",
  "preferences",
  {
    participantId: "cursor",
  },
);

// Get memories from multiple participants
const aiToolMemories = await cortex.memory.search("user-123-personal", "code", {
  participantId: ["cursor", "github-copilot"],
});

// Exclude a participant
const withoutBot = await cortex.memory.search("user-123-personal", "all", {
  excludeParticipant: "spam-bot",
});
```

## Real-World Examples

### Example 1: Personal AI Assistant (MCP)

```typescript
// Setup: User installs MCP server
// MCP creates one memory space per user

// ===== Cursor IDE =====
// User asks Cursor about TypeScript
await cortex.memory.remember({
  memorySpaceId: "user-alice-personal",
  participantId: "cursor",
  conversationId: "cursor-session-1",
  userMessage: "Show me TypeScript best practices",
  agentResponse: "Here are TS best practices...",
  userId: "user-alice",
  userName: "Alice",
});

// ===== Claude Desktop (later that day) =====
// User asks Claude for code review
const memories = await cortex.memory.search(
  "user-alice-personal",
  "typescript coding",
);
// Returns: "User interested in TypeScript best practices" (from Cursor!)

// Claude can provide context-aware response
const response = `I see you've been learning TypeScript best practices. 
Let me review your code with those in mind...`;

// ===== Result =====
// User experience: "My AI remembers me across all tools!"
```

### Example 2: Team Workspace

```typescript
// Engineering team Slack channel with multiple bots

// Bot 1: Code Review Bot
await cortex.memory.remember({
  memorySpaceId: "team-engineering-workspace",
  participantId: "code-review-bot",
  conversationId: "slack-thread-456",
  userMessage: "@code-review Please review PR #123",
  agentResponse: "✅ Code review complete. Found 2 minor issues.",
  userId: "engineer-bob",
  userName: "Bob",
});

// Bot 2: Deployment Bot (reads shared memory)
const recentReviews = await cortex.memory.search(
  "team-engineering-workspace",
  "code review PR #123",
);

// Bot 2 knows about Bot 1's review!
await cortex.memory.remember({
  memorySpaceId: "team-engineering-workspace",
  participantId: "deployment-bot",
  conversationId: "slack-thread-456",
  userMessage: "@deployment Deploy PR #123",
  agentResponse: "Deploying PR #123 (code review passed ✅)",
  userId: "engineer-bob",
  userName: "Bob",
});

// ===== Result =====
// Bots coordinate via shared memory
```

### Example 3: Multi-Platform App

```typescript
// User's data synced across web, mobile, CLI

// Web app
await cortex.memory.remember({
  memorySpaceId: "user-charlie-app",
  participantId: "web-app",
  conversationId: "web-session-789",
  userMessage: "Set my notification preference to email",
  agentResponse: "Email notifications enabled",
  userId: "user-charlie",
  userName: "Charlie",
});

// Mobile app (no sync delay!)
const prefs = await cortex.memory.search(
  "user-charlie-app",
  "notification preference",
);
// Immediately available: "Email notifications enabled"

// CLI tool
await cortex.memory.remember({
  memorySpaceId: "user-charlie-app",
  participantId: "cli-tool",
  conversationId: "cli-session-101",
  userMessage: "What are my notification settings?",
  agentResponse: "Email notifications are enabled (set via web app)",
  userId: "user-charlie",
  userName: "Charlie",
});

// ===== Result =====
// Perfect consistency across platforms
```

## Hive Mode vs Collaboration Mode

### When Both Are Used Together

You can mix modes! Here's a hybrid architecture:

```typescript
// Personal Hive: User's tools share one space
const personalSpace = "user-123-personal"; // Hive Mode
// Participants: cursor, claude, notion-ai

// Work Hive: Team's bots share one space
const teamSpace = "team-engineering-workspace"; // Hive Mode
// Participants: code-review-bot, deployment-bot, ticket-bot

// Specialist Agent: Autonomous security agent
const securitySpace = "security-agent-space"; // Collaboration Mode
// Isolated, communicates via A2A

// Security agent analyzes team workspace (cross-space)
const securityContext = await cortex.contexts.create({
  purpose: "Security audit of team workspace",
  memorySpaceId: securitySpace,
  metadata: {
    auditTarget: teamSpace,
  },
});

// Security agent can access team space via context chain (limited)
const teamContext = await cortex.contexts.get(securityContext.id, {
  includeChain: true,
  grantAccessTo: teamSpace, // Cross-space access
});

// ===== Result =====
// Hives for collaboration, isolation for security
```

## Security and Privacy

### What's Shared in Hive Mode

✅ **All memories** - Every participant can read all memories
✅ **All conversations** - Full conversation history shared
✅ **All facts** - Extracted facts accessible to all
✅ **All context** - Context chains visible to all

❌ **NOT shared:** User profiles (separate layer, not in memory space)
❌ **NOT shared:** Immutable KB (Layer 1b, globally shared across ALL spaces)

### Access Control

```typescript
// Hive Mode = full access for all participants
// No per-participant permissions

// If you need restrictions, use Collaboration Mode instead:
const restrictedSpace = "restricted-agent-space";
// Only this agent can access

// Or use context chains for limited delegation:
const limitedContext = await cortex.contexts.create({
  purpose: "Limited task",
  memorySpaceId: restrictedSpace,
  grantReadAccess: ["other-agent-space"], // Cross-space, read-only
});
```

### GDPR Compliance

```typescript
// Delete entire memory space (all participants' data)
await cortex.memorySpaces.delete("user-123-personal", {
  cascade: true, // Delete all memories, facts, conversations
  reason: "GDPR deletion request",
});

// Or delete specific participant's contributions
await cortex.memory.deleteMany("user-123-personal", {
  participantId: "cursor",
  reason: "Remove Cursor's contributions",
});
```

## Performance Considerations

### Benefits of Hive Mode

**1. Zero Duplication**

```typescript
// Traditional approach (separate agents)
await cortex.memory.remember({ memorySpaceId: "cursor-space", ... }); // Write 1
await cortex.memory.remember({ memorySpaceId: "claude-space", ... }); // Write 2
await cortex.memory.remember({ memorySpaceId: "notion-space", ... }); // Write 3
// Result: 3× storage, 3× writes

// Hive Mode
await cortex.memory.remember({ memorySpaceId: "user-123-personal", ... }); // Write 1
// Result: 1× storage, 1× write, 3 participants benefit
```

**2. Instant Consistency**

```
Traditional: Cursor writes → Sync to Claude → Sync to Notion (seconds/minutes)
Hive Mode: Cursor writes → Claude & Notion read immediately (<10ms)
```

**3. Simpler Queries**

```typescript
// Traditional: Query multiple spaces
const cursorMem = await cortex.memory.search("cursor-space", query);
const claudeMem = await cortex.memory.search("claude-space", query);
const notionMem = await cortex.memory.search("notion-space", query);
const combined = [...cursorMem, ...claudeMem, ...notionMem]; // Merge, dedupe

// Hive Mode: Single query
const memories = await cortex.memory.search("user-123-personal", query);
// Done!
```

### Potential Concerns

**Concern:** "Won't all participants see each other's data?"

**Answer:** Yes, that's the design! If you need isolation, use Collaboration Mode.

**Concern:** "What if one participant writes bad data?"

**Answer:** Use `participantId` to track and filter/delete bad data.

**Concern:** "Is it slower with many participants?"

**Answer:** No! Same performance. MemorySpaceId is the indexed field.

## Migration Patterns

### From Agent-Centric to Hive Mode

```typescript
// OLD (agent-centric, each agent has own space)
await cortex.memory.remember({
  agentId: "cursor-agent", // Separate space
  // ...
});

await cortex.memory.remember({
  agentId: "claude-agent", // Separate space
  // ...
});

// NEW (Hive Mode, shared space)
await cortex.memory.remember({
  memorySpaceId: "user-123-personal", // Shared
  participantId: "cursor", // Track who
  // ...
});

await cortex.memory.remember({
  memorySpaceId: "user-123-personal", // Same space
  participantId: "claude", // Track who
  // ...
});
```

### Migrating Data

```typescript
// Merge separate agent memories into one hive
async function migrateToHive(oldSpaces: string[], newHiveSpace: string) {
  for (const oldSpace of oldSpaces) {
    // Get all memories from old space
    const memories = await cortex.memory.list(oldSpace);

    // Copy to new hive space
    for (const memory of memories) {
      await cortex.memory.remember({
        memorySpaceId: newHiveSpace,
        participantId: oldSpace, // Track origin
        conversationId: memory.conversationRef?.conversationId,
        userMessage: memory.content,
        agentResponse: "", // Or extract from conversation
        userId: memory.userId,
        userName: memory.userId, // Or lookup
      });
    }

    // Optional: Delete old space
    await cortex.memorySpaces.delete(oldSpace);
  }
}

// Usage
await migrateToHive(
  ["cursor-agent", "claude-agent", "notion-agent"],
  "user-123-personal",
);
```

## Best Practices

### 1. Use Clear Memory Space Names

```typescript
// Good: Descriptive, scoped
"user-123-personal";
"team-engineering-workspace";
"project-apollo-memory";

// Bad: Ambiguous
"space1";
"memory";
"default";
```

### 2. Always Set participantId

```typescript
// Good: Track who stores what
await cortex.memory.remember({
  memorySpaceId: "team-workspace",
  participantId: "deployment-bot", // Clear tracking
  // ...
});

// Acceptable but not recommended
await cortex.memory.remember({
  memorySpaceId: "team-workspace",
  // participantId omitted - harder to debug
  // ...
});
```

### 3. Register Spaces for Production

```typescript
// Development: Implicit is fine
await cortex.memory.remember({
  memorySpaceId: "test-space",
  // ...
});

// Production: Explicit registration
await cortex.memorySpaces.register({
  id: "user-123-personal",
  name: "Alice's Personal Space",
  type: "personal",
  participants: ["cursor", "claude"],
  metadata: {
    environment: "production",
    created: new Date(),
  },
});
```

### 4. Use Meaningful Participant IDs

```typescript
// Good: Descriptive
"cursor" "claude-desktop" "github-copilot" "custom-finance-bot"

// Bad: Generic
"bot1" "agent" "ai" "participant"
```

### 5. Clean Up Inactive Participants

```typescript
// List participants
const space = await cortex.memorySpaces.get("user-123-personal");
console.log("Participants:", space.participants);

// Remove inactive participant
await cortex.memorySpaces.updateParticipants("user-123-personal", {
  remove: ["old-tool"], // User uninstalled this tool
});
```

## Debugging

### Find Which Participant Stored What

```typescript
// List all memories with participant info
const memories = await cortex.memory.list("team-workspace");

memories.forEach((m) => {
  console.log(`${m.participantId}: ${m.content.substring(0, 50)}...`);
});

// Output:
// code-review-bot: Code review complete for PR #123...
// deployment-bot: Deployed version 2.1.0 to producti...
// ticket-bot: Ticket JIRA-456 closed...
```

### Analyze Participant Activity

```typescript
// Get participant stats
const stats = await cortex.analytics.getMemorySpaceStats("team-workspace");

console.log(stats.participantActivity);
// {
//   "code-review-bot": { memoriesStored: 234, lastActive: "2025-10-28" },
//   "deployment-bot": { memoriesStored: 156, lastActive: "2025-10-28" },
//   "ticket-bot": { memoriesStored: 89, lastActive: "2025-10-27" }
// }
```

### Identify and Remove Bad Data

```typescript
// Find memories from problematic participant
const badMemories = await cortex.memory.list("team-workspace", {
  participantId: "buggy-bot",
});

// Review and delete if needed
for (const memory of badMemories) {
  console.log("Review:", memory.content);
  // Decide if bad
  await cortex.memory.delete("team-workspace", memory.id);
}
```

## Common Pitfalls

### Pitfall 1: Mixing Hive and Collaboration

```typescript
// ❌ BAD: Trying to use both patterns inconsistently
await cortex.memory.remember({
  memorySpaceId: "shared-space", // Hive Mode
  // ...
});

await cortex.a2a.send({
  from: "agent-1",
  to: "agent-2",
  // A2A expects separate spaces (Collaboration Mode)
  // Confusing!
});

// ✅ GOOD: Pick one pattern per use case
// For Hive Mode: All participants use same memorySpaceId
// For Collaboration: Use A2A between different memorySpaces
```

### Pitfall 2: Forgetting participantId

```typescript
// ❌ BAD: No tracking
await cortex.memory.remember({
  memorySpaceId: "team-workspace",
  // participantId: ???
  // ...
});
// Later: "Who stored this bad data?" - Can't tell!

// ✅ GOOD: Always track
await cortex.memory.remember({
  memorySpaceId: "team-workspace",
  participantId: "deployment-bot",
  // ...
});
```

### Pitfall 3: Per-User Spaces in Multi-Tenant SaaS

```typescript
// ❌ BAD: All customers in one hive
await cortex.memory.remember({
  memorySpaceId: "saas-app-memory", // All customers share!
  participantId: "customer-123",
  // ...
});
// Privacy violation!

// ✅ GOOD: One memory space per customer
await cortex.memory.remember({
  memorySpaceId: `customer-${customerId}-space`, // Isolated
  participantId: "saas-app",
  // ...
});
```

## Conclusion

**Hive Mode is perfect when:**

- Multiple tools should share memory (MCP, personal AI)
- You want zero duplication
- Instant consistency matters
- You trust all participants

**Use Collaboration Mode when:**

- Agents need independent memory
- Strict isolation required
- Autonomous decision-making
- Compliance requires separate audit trails

**Key Takeaway:** Hive Mode = shared memory space. It's that simple!

---

**Next Steps:**

- [Memory Spaces Guide](./01-memory-spaces.md) - Full memory space architecture
- [A2A Communication](./05-a2a-communication.md) - Learn Collaboration Mode
- [Context Chains](./04-context-chains.md) - Cross-space delegation
- [MCP Server](./09-mcp-server.md) - Hive Mode for MCP integration

**Questions?** Ask in [Discussions](https://github.com/SaintNick1214/Project-Cortex/discussions).
