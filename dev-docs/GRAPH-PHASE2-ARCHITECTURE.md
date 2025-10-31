# Graph Phase 2: Architecture & Implementation Guide

> **Purpose**: Complete architecture for systematic syncToGraph integration  
> **Status**: Infrastructure complete, systematic rollout in progress  
> **Scope**: 21 methods across 7 APIs + convenience layer + real-time sync

---

## Executive Summary

Phase 2 adds **opt-in graph synchronization** to every Cortex API method, with:

- ✅ Sophisticated orphan detection (circular-reference safe)
- ✅ Cascading deletes with cleanup
- ✅ Consistent `syncToGraph` option pattern across all layers
- ✅ Auto-sync in convenience APIs (`memory.remember`)
- ✅ Manual sync in low-level APIs (developer control)

---

## Architecture: Where Graph Fits

### The Layer Stack with Graph

```
┌──────────────────────────────────────────────────────────┐
│ CONVENIENCE LAYER (memory.remember, memory.recall)      │
│ - Auto-syncs to graph if configured (default: true)     │
│ - Orchestrates L1a + L2 + L3 + L4 + Graph               │
│ - Implements Proof #7 enrichment pattern                │
└───────────────────────────┬──────────────────────────────┘
                            ↓
┌──────────────────────────────────────────────────────────┐
│ PRIMITIVE LAYER (conversations, vector, facts, contexts)│
│ - syncToGraph: boolean option (default: false)          │
│ - Developer chooses when to sync                        │
│ - Full control, can opt-out of graph                    │
└───────────────────────────┬──────────────────────────────┘
                            ↓
┌──────────────────────────────────────────────────────────┐
│ GRAPH LAYER (cortex.graph.*)                            │
│ - Manual sync methods (cortex.graph.sync.memory)        │
│ - Enriched search (cortex.graph.enrichedSearch)         │
│ - Query methods (traverse, findPath, etc.)              │
│ - Health monitoring                                      │
└──────────────────────────────────────────────────────────┘
```

### Sync Decision Tree

```
User calls API method
  ↓
Is graph configured? (config.graph exists)
  ├─ NO → Skip graph logic entirely (fast path)
  └─ YES → Continue
       ↓
  Is syncToGraph option true?
    ├─ NO → Skip graph sync (developer opted out)
    └─ YES → Sync to graph
         ↓
    Is this a DELETE operation?
      ├─ NO → Sync entity + relationships
      └─ YES → Delete with orphan cleanup
           ↓
      Orphan detection algorithm:
        1. Find references to deleted node
        2. Filter out nodes being deleted
        3. Check for circular islands
        4. Delete orphans recursively
```

---

## Implementation Pattern (Applied to All 21 Methods)

### CREATE/STORE Operations

```typescript
async store(
  memorySpaceId: string,
  input: StoreMemoryInput,
  options?: StoreMemoryOptions  // NEW parameter
): Promise<MemoryEntry> {
  // 1. Execute Convex mutation (existing logic)
  const result = await this.client.mutation(api.memories.store, {
    memorySpaceId,
    ...input,
  });

  // 2. NEW: Sync to graph if requested
  if (options?.syncToGraph && this.graphAdapter) {
    const nodeId = await syncMemoryToGraph(result, this.graphAdapter);
    await syncMemoryRelationships(result, nodeId, this.graphAdapter);
  }

  // 3. Return result (existing)
  return result as MemoryEntry;
}
```

### UPDATE Operations

```typescript
async update(
  memorySpaceId: string,
  memoryId: string,
  updates: Partial<MemoryEntry>,
  options?: UpdateMemoryOptions  // NEW parameter
): Promise<MemoryEntry> {
  // 1. Execute Convex mutation (existing)
  const result = await this.client.mutation(api.memories.update, {
    memorySpaceId,
    memoryId,
    ...updates,
  });

  // 2. NEW: Sync updates to graph
  if (options?.syncToGraph && this.graphAdapter) {
    const nodes = await this.graphAdapter.findNodes("Memory", { memoryId }, 1);
    if (nodes.length > 0) {
      await this.graphAdapter.updateNode(nodes[0].id!, updates);
      // Re-sync relationships if they changed
      await syncMemoryRelationships(result, nodes[0].id!, this.graphAdapter);
    }
  }

  // 3. Return result
  return result as MemoryEntry;
}
```

### DELETE Operations (With Orphan Cleanup)

```typescript
async delete(
  memorySpaceId: string,
  memoryId: string,
  options?: DeleteMemoryOptions  // NEW parameter
): Promise<void> {
  // 1. Execute Convex mutation (existing)
  await this.client.mutation(api.memories.delete, {
    memorySpaceId,
    memoryId,
  });

  // 2. NEW: Delete from graph with orphan cleanup
  if (options?.syncToGraph && this.graphAdapter) {
    const deleteResult = await deleteMemoryFromGraph(
      memoryId,
      this.graphAdapter,
      true  // Enable orphan cleanup
    );

    // Log what was deleted
    console.log(`Deleted ${deleteResult.deletedNodes.length} nodes (including orphans)`);
    if (deleteResult.orphanIslands.length > 0) {
      console.log(`Removed ${deleteResult.orphanIslands.length} orphan islands`);
    }
  }

  // 3. Return
}
```

---

## Complete Method Update Checklist

### Layer 1a: ConversationsAPI ✅ (Constructors Done)

- [ ] `create(input, options)` - Add syncToGraph
- [ ] `addMessage(input, options)` - Add syncToGraph
- [ ] `update(conversationId, updates, options)` - Add syncToGraph
- [ ] `delete(conversationId, options)` - Add syncToGraph + orphan cleanup

### Layer 2: VectorAPI ✅ (Constructors Done)

- [ ] `store(memorySpaceId, input, options)` - Add syncToGraph
- [ ] `update(memorySpaceId, memoryId, updates, options)` - Add syncToGraph
- [ ] `delete(memorySpaceId, memoryId, options)` - Add syncToGraph + orphan cleanup

### Layer 3: FactsAPI ✅ (Constructors Done)

- [ ] `store(params, options)` - Add syncToGraph
- [ ] `update(memorySpaceId, factId, updates, options)` - Add syncToGraph
- [ ] `delete(memorySpaceId, factId, options)` - Add syncToGraph + orphan cleanup

### Layer 4: ContextsAPI ✅ (Constructors Done)

- [ ] `create(params, options)` - Add syncToGraph
- [ ] `update(contextId, updates, options)` - Add syncToGraph
- [ ] `delete(contextId, options)` - Add syncToGraph + orphan cleanup

### Layer 4: MemorySpacesAPI ✅ (Constructors Done)

- [ ] `register(params, options)` - Add syncToGraph
- [ ] `unregister(memorySpaceId, options)` - Add syncToGraph + careful cleanup

### Layer 1b: ImmutableAPI ✅ (Constructors Done)

- [ ] `store(entry, options)` - Add syncToGraph
- [ ] `update(type, id, data, options)` - Add syncToGraph
- [ ] `delete(type, id, options)` - Add syncToGraph + orphan cleanup

### Layer 1c: MutableAPI ✅ (Constructors Done)

- [ ] `set(input, options)` - Add syncToGraph
- [ ] `update(input, options)` - Add syncToGraph
- [ ] `delete(namespace, key, options)` - Add syncToGraph + simple cleanup

**Total**: 24 methods to update

---

## Current Status

### ✅ Completed (Hours 1-2)

1. Orphan detection infrastructure
2. Delete cascade utilities
3. Type system (25 interfaces)
4. All API constructors

### 🚧 In Progress (Hours 3-8)

Working through 24 method updates systematically

### ⏳ Remaining (Hours 9-12)

- GraphAPI high-level class
- memory.remember() auto-sync
- memory.forget() implementation
- Real-time sync worker
- Testing
- Documentation

**Total Estimated**: 12-15 hours of focused implementation

---

This checkpoint allows resumption at any point. Continuing with method updates...
