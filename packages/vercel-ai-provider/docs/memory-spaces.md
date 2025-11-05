# Memory Spaces Guide

Multi-tenancy and isolation with Cortex Memory Spaces.

## Overview

Memory Spaces provide isolated memory contexts for different users, teams, or projects.

## Use Cases

### 1. Per-User Isolation

```typescript
const cortexMemory = createCortexMemory({
  convexUrl: process.env.CONVEX_URL!,
  memorySpaceId: `user-${currentUser.id}`,
  userId: currentUser.id,
});
```

### 2. Team Workspaces

```typescript
const cortexMemory = createCortexMemory({
  convexUrl: process.env.CONVEX_URL!,
  memorySpaceId: `team-${currentTeam.id}`,
  userId: currentUser.id,
});
```

### 3. Project-Based

```typescript
const cortexMemory = createCortexMemory({
  convexUrl: process.env.CONVEX_URL!,
  memorySpaceId: `project-${projectId}`,
  userId: currentUser.id,
});
```

## Benefits

- 🔒 Data isolation
- 🏢 Multi-tenant SaaS ready
- 👥 Team collaboration
- 📊 Per-space analytics

See examples/memory-spaces for complete multi-tenant application.

