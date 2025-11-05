# Cortex Memory - Hive Mode Example

Cross-application memory sharing between multiple agents/tools.

## Features
- 🐝 Shared memory space across applications
- 👥 Participant tracking (which agent responded)
- 🔄 Real-time updates with Convex

Configure with `participantId` to track which agent/tool is interacting.

```typescript
const cortexMemory = createCortexMemory({
  memorySpaceId: 'shared-workspace',
  userId: 'user-123',
  hiveMode: {
    participantId: 'assistant-a', // Track this agent
  },
});
```

