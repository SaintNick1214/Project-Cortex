# Hive Mode - Cross-Application Memory

Share memory across multiple agents and applications.

## Overview

Hive Mode enables multiple agents/tools to share a single memory space, creating a unified context across your entire AI ecosystem.

## Setup

```typescript
const cortexMemory = createCortexMemory({
  convexUrl: process.env.CONVEX_URL!,
  memorySpaceId: 'shared-workspace', // Same across apps
  userId: currentUser.id,
  
  hiveMode: {
    participantId: 'web-assistant', // Identify this agent
  },
});
```

## Use Cases

### 1. Next.js App + Cursor + Claude

```typescript
// All three share the same memory space:
// - Your Next.js app (participantId: 'web-app')
// - Cursor (participantId: 'cursor')
// - Claude Desktop (participantId: 'claude-desktop')

// They can all see each other's conversations
```

### 2. Multi-Agent Systems

```typescript
// Agent A
const agentA = createCortexMemory({
  memorySpaceId: 'team-workspace',
  userId: 'user-123',
  hiveMode: { participantId: 'analyzer' },
});

// Agent B
const agentB = createCortexMemory({
  memorySpaceId: 'team-workspace',
  userId: 'user-123',
  hiveMode: { participantId: 'writer' },
});

// Both see all memories, but can filter by participant
```

## Benefits

- 🐝 Unified context across tools
- 👥 Multi-agent coordination
- 🔄 Real-time updates
- 📍 Participant tracking

See examples/hive-mode for complete implementation.

