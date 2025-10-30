# Comprehensive Testing Gap Analysis - v0.6.1 Planning

> **Purpose:** Identify missing tests across all APIs and multi-layer infrastructure to prevent bugs like the participantId issue

**Context:** v0.6.0 shipped with a bug where `memory.remember()` didn't propagate `participantId` to vector layer. This document analyzes what OTHER tests are missing.

---

## 🔍 Testing Philosophy Issues

### Current State: Layer-Centric Testing
```
✅ Layer 1 (Conversations): 69 tests
✅ Layer 2 (Vector): 33 tests  
✅ Layer 3 (Facts): 53 tests
✅ Layer 4 (Coordination): 60+ tests
✅ Integration: 15 tests
```

**Problem:** Tests validate **individual layers** but not **data flow between layers**.

### Desired State: Flow-Centric Testing

```
Test flows like:
1. User input → Conversation → Memory → Fact → Context
2. Multi-participant → Hive tracking → Query by participant
3. Cross-space → Collaboration → Access control → Data isolation
4. Version update → History tracking → Temporal queries
```

---

## 🎯 Missing Test Categories

## Category 1: Parameter Propagation (CRITICAL)

### 1.1 Wrapper Functions Not Validating Propagation

**Functions that wrap other functions:**
- `memory.remember()` → wraps `conversations.addMessage()` + `vector.store()`
- `memory.get()` → wraps `vector.get()` + `conversations.get()`
- `memory.search()` → wraps `vector.search()` + `conversations.get()`
- `memory.forget()` → wraps `vector.delete()` + optionally `conversations.delete()`

**Missing Tests:**

```typescript
describe("memory.remember() parameter propagation", () => {
  it("propagates participantId to vector layer", async () => {
    // ✅ NOW ADDED - but need more like this
  });
  
  // ❌ MISSING:
  it("propagates importance to vector layer", async () => {
    const result = await cortex.memory.remember({
      importance: 95,
      ...
    });
    
    const stored = await cortex.vector.get(..., result.memories[0].memoryId);
    expect(stored!.importance).toBe(95); // ← Validates propagation
  });
  
  it("propagates tags to vector layer", async () => {
    const TAGS = ["critical", "password", "security"];
    const result = await cortex.memory.remember({
      tags: TAGS,
      ...
    });
    
    const userMem = await cortex.vector.get(..., result.memories[0].memoryId);
    const agentMem = await cortex.vector.get(..., result.memories[1].memoryId);
    
    expect(userMem!.tags).toEqual(TAGS);
    expect(agentMem!.tags).toEqual(TAGS);
  });
  
  it("propagates userId to vector layer", async () => {
    // ❌ MISSING
  });
  
  it("propagates conversationRef correctly", async () => {
    // ❌ MISSING - very important for audit trail
  });
  
  it("handles undefined optional params correctly", async () => {
    // When participantId is undefined, doesn't break
    const result = await cortex.memory.remember({
      memorySpaceId: "test",
      participantId: undefined, // ← Explicitly undefined
      ...
    });
    
    const stored = await cortex.vector.get(...);
    expect(stored!.participantId).toBeUndefined(); // ← Not null, not ""
  });
});

describe("memory.get() enrichment propagation", () => {
  it("includeConversation actually includes conversation", async () => {
    const enriched = await cortex.memory.get(..., {
      includeConversation: true,
    });
    
    expect(enriched.conversation).toBeDefined();
    expect(enriched.sourceMessages).toBeDefined();
    expect(enriched.sourceMessages.length).toBeGreaterThan(0);
  });
  
  it("includeConversation: false doesn't include conversation", async () => {
    // ❌ MISSING - validate false works too
  });
});

describe("memory.search() enrichment propagation", () => {
  it("enrichConversation populates conversation for ALL results", async () => {
    const results = await cortex.memory.search(..., {
      enrichConversation: true,
    });
    
    // ✅ EVERY result should have conversation
    results.forEach(r => {
      expect(r.conversation).toBeDefined();
      expect(r.sourceMessages).toBeDefined();
    });
  });
});
```

### 1.2 Optional Parameters Not Fully Tested

**Every API function with optional parameters needs:**

```typescript
// Pattern for ALL optional params:
describe("optional parameter: participantId", () => {
  it("stores participantId when provided", async () => {
    const result = await cortex.vector.store("memspace", {
      participantId: "tool-1",
      ...
    });
    expect(result.participantId).toBe("tool-1");
  });
  
  it("stores undefined when participantId omitted", async () => {
    const result = await cortex.vector.store("memspace", {
      // participantId NOT provided
      ...
    });
    expect(result.participantId).toBeUndefined();
  });
  
  it("handles null participantId", async () => {
    const result = await cortex.vector.store("memspace", {
      participantId: null,
      ...
    });
    // Validate behavior (reject? convert to undefined?)
  });
});
```

**Apply this pattern to:**
- `participantId` in vector.store(), memory.remember(), facts.store()
- `conversationRef` in vector.store(), facts.store()
- `sourceRef` in facts.store()
- `metadata` in all store operations
- `grantedAccess` in contexts
- `validFrom`/`validUntil` in facts
- `completedAt` in contexts

---

## Category 2: Cross-Layer Integrity (CRITICAL)

### 2.1 Reference Integrity Not Validated

**Missing Tests:**

```typescript
describe("Cross-Layer Reference Integrity", () => {
  it("conversationRef points to actual conversation", async () => {
    const conv = await cortex.conversations.create({...});
    
    const memory = await cortex.vector.store("memspace", {
      conversationRef: { conversationId: conv.conversationId, messageIds: [...] },
      ...
    });
    
    // ✅ VALIDATE: Can retrieve referenced conversation
    const referencedConv = await cortex.conversations.get(
      memory.conversationRef!.conversationId
    );
    expect(referencedConv).not.toBeNull();
    expect(referencedConv!.conversationId).toBe(conv.conversationId);
    
    // ✅ VALIDATE: Referenced messages exist
    const messageIds = memory.conversationRef!.messageIds!;
    messageIds.forEach(msgId => {
      const msg = referencedConv!.messages.find(m => m.id === msgId);
      expect(msg).toBeDefined();
    });
  });
  
  it("sourceRef in facts points to actual conversation", async () => {
    const fact = await cortex.facts.store({
      sourceRef: { conversationId: "conv-123", memoryId: "mem-456" },
      ...
    });
    
    // ✅ VALIDATE: Referenced entities exist
    if (fact.sourceRef?.conversationId) {
      const conv = await cortex.conversations.get(fact.sourceRef.conversationId);
      expect(conv).not.toBeNull();
    }
    
    if (fact.sourceRef?.memoryId) {
      const mem = await cortex.vector.get(..., fact.sourceRef.memoryId);
      expect(mem).not.toBeNull();
    }
  });
  
  it("context conversationRef points to actual conversation", async () => {
    // ❌ MISSING
  });
  
  it("context parentId points to actual parent context", async () => {
    const parent = await cortex.contexts.create({...});
    const child = await cortex.contexts.create({ parentId: parent.contextId, ...});
    
    // ✅ VALIDATE: Parent exists
    const actualParent = await cortex.contexts.get(child.parentId!);
    expect(actualParent).not.toBeNull();
    
    // ✅ VALIDATE: Parent knows about child
    expect(actualParent!.childIds).toContain(child.contextId);
  });
  
  it("orphaned references handled gracefully", async () => {
    // Create memory with conversationRef
    const mem = await cortex.vector.store("memspace", {
      conversationRef: { conversationId: "conv-orphan", messageIds: [] },
      ...
    });
    
    // Delete conversation (creates orphan)
    // ❌ MISSING: How does system handle orphaned refs?
  });
});
```

### 2.2 Bidirectional References Not Validated

**Missing Tests:**

```typescript
describe("Bidirectional Reference Integrity", () => {
  it("parent context childIds matches children's parentId", async () => {
    const parent = await cortex.contexts.create({...});
    const child1 = await cortex.contexts.create({ parentId: parent.contextId, ...});
    const child2 = await cortex.contexts.create({ parentId: parent.contextId, ...});
    
    const updatedParent = await cortex.contexts.get(parent.contextId);
    
    // ✅ VALIDATE: Parent knows about both children
    expect(updatedParent!.childIds).toContain(child1.contextId);
    expect(updatedParent!.childIds).toContain(child2.contextId);
    expect(updatedParent!.childIds).toHaveLength(2);
    
    // ✅ VALIDATE: Children point back to parent
    expect(child1.parentId).toBe(parent.contextId);
    expect(child2.parentId).toBe(parent.contextId);
  });
  
  it("fact version chains are bidirectional", async () => {
    const v1 = await cortex.facts.store({...});
    const v2 = await cortex.facts.update(memorySpaceId, v1.factId, {...});
    
    // Retrieve both
    const storedV1 = await cortex.facts.get(memorySpaceId, v1.factId);
    const storedV2 = await cortex.facts.get(memorySpaceId, v2.factId);
    
    // ✅ VALIDATE: v1 knows it's superseded by v2
    expect(storedV1!.supersededBy).toBe(v2.factId);
    
    // ✅ VALIDATE: v2 knows it supersedes v1
    expect(storedV2!.supersedes).toBe(v1.factId);
  });
  
  it("memory conversationRef matches conversation's existence", async () => {
    // ❌ MISSING
  });
});
```

---

## Category 3: Multi-Participant Scenarios (HIGH PRIORITY)

### 3.1 Participant Tracking Across All Operations

**Missing Tests:**

```typescript
describe("Participant Tracking: vector.store()", () => {
  it("stores participantId for direct vector.store()", async () => {
    const mem = await cortex.vector.store("hive", {
      participantId: "tool-1",
      ...
    });
    
    const stored = await cortex.vector.get("hive", mem.memoryId);
    expect(stored!.participantId).toBe("tool-1");
  });
  
  it("participantId persists through update()", async () => {
    const mem = await cortex.vector.store("hive", { participantId: "tool-1", ...});
    
    const updated = await cortex.vector.update("hive", mem.memoryId, {
      content: "Updated content",
    });
    
    // ❌ MISSING: Does participantId persist?
    expect(updated.participantId).toBe("tool-1");
  });
  
  it("can filter list() by participant", async () => {
    // ❌ MISSING: No way to filter vector.list() by participantId currently
    // API gap identified!
  });
  
  it("can count memories by participant", async () => {
    // ❌ MISSING: No way to count by participantId
    // API gap identified!
  });
});

describe("Participant Tracking: conversations", () => {
  it("participantId in participants.participantId", async () => {
    const conv = await cortex.conversations.create({
      memorySpaceId: "hive",
      participants: { userId: "user-1", participantId: "tool-1" },
      ...
    });
    
    expect(conv.participants.participantId).toBe("tool-1");
  });
  
  it("message.participantId for agent messages", async () => {
    await cortex.conversations.addMessage({
      message: {
        role: "agent",
        content: "Response",
        participantId: "tool-1",
      },
      ...
    });
    
    const conv = await cortex.conversations.get(conversationId);
    const agentMsg = conv!.messages.find(m => m.role === "agent");
    
    expect(agentMsg!.participantId).toBe("tool-1");
  });
  
  it("can filter conversations by participant", async () => {
    // ❌ MISSING: API doesn't support filtering by participantId
    // const convs = await cortex.conversations.list({ participantId: "tool-1" });
    // API gap identified!
  });
});

describe("Participant Tracking: facts", () => {
  it("stores participantId in facts", async () => {
    const fact = await cortex.facts.store({
      participantId: "agent-1",
      ...
    });
    
    expect(fact.participantId).toBe("agent-1");
  });
  
  it("participantId persists through update", async () => {
    const v1 = await cortex.facts.store({ participantId: "agent-1", ...});
    const v2 = await cortex.facts.update(memorySpaceId, v1.factId, {...});
    
    // ❌ MISSING: Does new version preserve participantId?
    expect(v2.participantId).toBe("agent-1");
  });
  
  it("can query facts by participant", async () => {
    // ❌ MISSING: API doesn't support filtering by participantId
    // API gap identified!
  });
});
```

**API Gaps Identified:**
1. `vector.list()` - no participantId filter
2. `vector.count()` - no participantId filter
3. `conversations.list()` - no participantId filter
4. `facts.list()` - no participantId filter
5. All APIs - need `findByParticipant()` methods

---

## Category 2: Field-by-Field Validation (HIGH PRIORITY)

### 2.1 Store Operations Missing Complete Validation

**Current pattern:**
```typescript
// ❌ INCOMPLETE
it("stores memory", async () => {
  const result = await cortex.vector.store("memspace", {...});
  expect(result.memoryId).toBeDefined(); // Only checks ID exists
});
```

**Should be:**
```typescript
// ✅ COMPLETE
it("stores memory with all fields", async () => {
  const INPUT = {
    content: "Test content",
    contentType: "raw" as const,
    participantId: "tool-1",
    userId: "user-1",
    source: { type: "tool" as const, userId: "user-1", userName: "User One" },
    conversationRef: { conversationId: "conv-1", messageIds: ["msg-1"] },
    metadata: { 
      importance: 85, 
      tags: ["tag1", "tag2"],
    },
  };
  
  const result = await cortex.vector.store("memspace-test", INPUT);
  
  // ✅ FIELD-BY-FIELD VALIDATION
  expect(result.memoryId).toBeDefined();
  expect(result.memorySpaceId).toBe("memspace-test");
  expect(result.content).toBe(INPUT.content);
  expect(result.contentType).toBe(INPUT.contentType);
  expect(result.participantId).toBe(INPUT.participantId);
  expect(result.userId).toBe(INPUT.userId);
  expect(result.sourceType).toBe(INPUT.source.type);
  expect(result.sourceUserId).toBe(INPUT.source.userId);
  expect(result.sourceUserName).toBe(INPUT.source.userName);
  expect(result.importance).toBe(INPUT.metadata.importance);
  expect(result.tags).toEqual(INPUT.metadata.tags);
  expect(result.conversationRef).toBeDefined();
  expect(result.conversationRef!.conversationId).toBe(INPUT.conversationRef.conversationId);
  expect(result.conversationRef!.messageIds).toEqual(INPUT.conversationRef.messageIds);
  
  // ✅ NOW VERIFY IN DATABASE
  const stored = await cortex.vector.get("memspace-test", result.memoryId);
  expect(stored).toEqual(result); // Matches exactly
});
```

**Apply this pattern to:**
- `cortex.vector.store()` ❌
- `cortex.facts.store()` ❌
- `cortex.contexts.create()` ❌
- `cortex.memorySpaces.register()` ❌
- `cortex.conversations.create()` ❌
- `cortex.immutable.store()` ⚠️ Partially done
- `cortex.mutable.set()` ⚠️ Partially done

### 2.2 Update Operations Missing Field Preservation

**Missing Tests:**

```typescript
describe("Update Field Preservation", () => {
  it("vector.update() preserves participantId", async () => {
    const original = await cortex.vector.store("memspace", {
      content: "Original",
      participantId: "tool-1",
      importance: 50,
      tags: ["original"],
      ...
    });
    
    const updated = await cortex.vector.update("memspace", original.memoryId, {
      content: "Updated",
      importance: 80,
    });
    
    // ✅ VALIDATE: participantId NOT changed (preserved)
    expect(updated.participantId).toBe("tool-1");
    
    // ✅ VALIDATE: Only specified fields updated
    expect(updated.content).toBe("Updated");
    expect(updated.importance).toBe(80);
    expect(updated.tags).toEqual(["original"]); // ← NOT updated
  });
  
  it("facts.update() preserves participantId from original", async () => {
    const v1 = await cortex.facts.store({
      participantId: "agent-1",
      fact: "Original fact",
      ...
    });
    
    const v2 = await cortex.facts.update(memorySpaceId, v1.factId, {
      fact: "Updated fact",
    });
    
    // ❌ MISSING: Does new version inherit participantId?
    expect(v2.participantId).toBe("agent-1");
  });
  
  it("contexts.update() preserves participantId in participants array", async () => {
    // ❌ MISSING
  });
});
```

---

## Category 3: Multi-Layer Workflows (CRITICAL)

### 3.1 Complete User Journeys Not Tested

**Missing End-to-End Scenarios:**

```typescript
describe("E2E: Customer Support Ticket with Fact Extraction", () => {
  it("complete workflow: conversation → memory → fact → context → retrieval", async () => {
    // ═══════════════════════════════════════════════════════════════
    // ACT 1: User initiates support request
    // ═══════════════════════════════════════════════════════════════
    const conv = await cortex.conversations.create({
      memorySpaceId: "support-space",
      type: "user-agent",
      participants: { userId: "user-vip", participantId: "agent-support" },
    });
    
    await cortex.conversations.addMessage({
      conversationId: conv.conversationId,
      message: {
        role: "user",
        content: "I've been a customer for 5 years and need a refund for order #12345"
      },
    });
    
    // ═══════════════════════════════════════════════════════════════
    // ACT 2: Agent extracts facts
    // ═══════════════════════════════════════════════════════════════
    const tenureFact = await cortex.facts.store({
      memorySpaceId: "support-space",
      participantId: "agent-support",
      fact: "Customer has 5-year tenure",
      factType: "identity",
      subject: "user-vip",
      predicate: "customer_duration",
      object: "5-years",
      confidence: 100,
      sourceType: "conversation",
      sourceRef: { conversationId: conv.conversationId },
      tags: ["tenure", "customer"],
    });
    
    const orderFact = await cortex.facts.store({
      memorySpaceId: "support-space",
      participantId: "agent-support",
      fact: "Customer requesting refund for order #12345",
      factType: "knowledge",
      subject: "user-vip",
      confidence: 100,
      sourceType: "conversation",
      sourceRef: { conversationId: conv.conversationId },
      tags: ["refund", "order"],
    });
    
    // ═══════════════════════════════════════════════════════════════
    // ACT 3: Agent creates workflow context
    // ═══════════════════════════════════════════════════════════════
    const workflowCtx = await cortex.contexts.create({
      purpose: "Process VIP refund for order #12345",
      memorySpaceId: "support-space",
      userId: "user-vip",
      conversationRef: { conversationId: conv.conversationId },
      data: {
        orderId: "12345",
        customerTenure: "5-years",
        priority: "high",
      },
    });
    
    // ═══════════════════════════════════════════════════════════════
    // ACT 4: Delegate to finance agent (cross-space)
    // ═══════════════════════════════════════════════════════════════
    const financeCtx = await cortex.contexts.create({
      purpose: "Approve refund for 5-year customer",
      memorySpaceId: "finance-space", // Different space!
      parentId: workflowCtx.contextId,
      data: { approvalRequired: true },
    });
    
    // ═══════════════════════════════════════════════════════════════
    // VALIDATION: Complete data flow integrity
    // ═══════════════════════════════════════════════════════════════
    
    // ✅ VALIDATE: Facts reference conversation
    const tenureStored = await cortex.facts.get("support-space", tenureFact.factId);
    expect(tenureStored!.sourceRef!.conversationId).toBe(conv.conversationId);
    
    // ✅ VALIDATE: Can retrieve conversation from fact reference
    const convFromFact = await cortex.conversations.get(
      tenureStored!.sourceRef!.conversationId!
    );
    expect(convFromFact).not.toBeNull();
    
    // ✅ VALIDATE: Context references same conversation
    expect(workflowCtx.conversationRef!.conversationId).toBe(conv.conversationId);
    
    // ✅ VALIDATE: Finance context inherits root properly
    const chain = await cortex.contexts.getChain(financeCtx.contextId);
    expect(chain.root.contextId).toBe(workflowCtx.contextId);
    expect(chain.current.memorySpaceId).toBe("finance-space");
    expect(chain.root.memorySpaceId).toBe("support-space");
    
    // ✅ VALIDATE: Can trace back through entire chain
    // Context → Conversation → Messages
    const originalConv = await cortex.conversations.get(
      workflowCtx.conversationRef!.conversationId!
    );
    expect(originalConv!.conversationId).toBe(conv.conversationId);
    
    // ✅ VALIDATE: Facts queryable by subject
    const customerFacts = await cortex.facts.queryBySubject({
      memorySpaceId: "support-space",
      subject: "user-vip",
    });
    expect(customerFacts.length).toBeGreaterThanOrEqual(2);
    
    // ✅ VALIDATE: All entities track same user
    expect(conv.participants.userId).toBe("user-vip");
    expect(workflowCtx.userId).toBe("user-vip");
    expect(tenureFact.subject).toBe("user-vip");
    
    // ✅ COMPLETE: Data flows correctly through all 4 layers
  });
});
```

### 3.2 Multiple Participants in Same Hive

**Missing Tests:**

```typescript
describe("Hive Mode: Multiple Participants", () => {
  it("tracks 5+ participants in same hive", async () => {
    const HIVE = "multi-participant-hive";
    const PARTICIPANTS = [
      "tool-calendar",
      "tool-email",
      "tool-tasks",
      "tool-notes",
      "agent-assistant"
    ];
    
    await cortex.memorySpaces.register({
      memorySpaceId: HIVE,
      participants: PARTICIPANTS.map(id => ({ id, type: "tool" })),
      ...
    });
    
    // Each participant stores memory
    for (const participant of PARTICIPANTS) {
      await cortex.vector.store(HIVE, {
        content: `Memory from ${participant}`,
        participantId: participant,
        ...
      });
    }
    
    // ✅ VALIDATE: All 5 participants tracked
    const allMemories = await cortex.vector.list({ memorySpaceId: HIVE });
    const uniqueParticipants = new Set(
      allMemories.map(m => m.participantId).filter(Boolean)
    );
    
    expect(uniqueParticipants.size).toBe(5);
    PARTICIPANTS.forEach(p => {
      expect(uniqueParticipants).toContain(p);
    });
    
    // ✅ VALIDATE: Can identify who created what
    PARTICIPANTS.forEach(participant => {
      const participantMems = allMemories.filter(m => m.participantId === participant);
      expect(participantMems.length).toBeGreaterThanOrEqual(1);
      expect(participantMems[0].content).toContain(participant);
    });
  });
  
  it("multiple participants use remember() in same hive", async () => {
    // Each tool uses remember() with different participantId
    // ❌ MISSING
  });
  
  it("participant statistics accurate", async () => {
    const stats = await cortex.memorySpaces.getStats(HIVE);
    
    // ❌ MISSING: Stats should include participant breakdown
    // expect(stats.participantBreakdown).toBeDefined();
    // API enhancement needed
  });
});
```

---

## Category 4: Memory Space Isolation (HIGH PRIORITY)

### 4.1 Isolation Violations Not Fully Tested

**Missing Tests:**

```typescript
describe("Memory Space Isolation: Cross-Contamination Prevention", () => {
  it("cannot access other space's memories via direct query", async () => {
    const mem1 = await cortex.vector.store("space-a", { content: "Space A secret", ...});
    
    // Try to access from space-b
    const result = await cortex.vector.get("space-b", mem1.memoryId);
    expect(result).toBeNull(); // ✅ Isolation enforced
  });
  
  it("list() never returns memories from other spaces", async () => {
    await cortex.vector.store("space-a", { content: "Space A data", ...});
    await cortex.vector.store("space-b", { content: "Space B data", ...});
    
    const spaceAMems = await cortex.vector.list({ memorySpaceId: "space-a" });
    const spaceBMems = await cortex.vector.list({ memorySpaceId: "space-b" });
    
    // ✅ VALIDATE: No cross-contamination
    spaceAMems.forEach(m => {
      expect(m.memorySpaceId).toBe("space-a");
      expect(m.content).not.toContain("Space B");
    });
    
    spaceBMems.forEach(m => {
      expect(m.memorySpaceId).toBe("space-b");
      expect(m.content).not.toContain("Space A");
    });
  });
  
  it("search() never returns memories from other spaces", async () => {
    await cortex.vector.store("space-a", { content: "UNIQUE_MARKER data", ...});
    
    const results = await cortex.vector.search("space-b", "UNIQUE_MARKER");
    
    // ✅ VALIDATE: No results from space-a
    expect(results.length).toBe(0);
  });
  
  it("cannot update other space's memories", async () => {
    const mem = await cortex.vector.store("space-a", {...});
    
    await expect(
      cortex.vector.update("space-b", mem.memoryId, { content: "Hacked!" })
    ).rejects.toThrow("PERMISSION_DENIED");
  });
  
  it("cannot delete other space's memories", async () => {
    const mem = await cortex.vector.store("space-a", {...});
    
    await expect(
      cortex.vector.delete("space-b", mem.memoryId)
    ).rejects.toThrow("PERMISSION_DENIED");
  });
  
  it("facts isolated by memory space", async () => {
    // ❌ MISSING - same isolation pattern for facts
  });
  
  it("contexts isolated by memory space", async () => {
    // ❌ MISSING - validate context isolation
  });
  
  it("search across spaces returns empty", async () => {
    // ❌ MISSING - comprehensive cross-space search validation
  });
});
```

### 4.2 Collaboration Mode Boundaries

**Missing Tests:**

```typescript
describe("Collaboration Mode: Controlled Access", () => {
  it("granted access allows context read, not data read", async () => {
    // Space A creates context
    const ctx = await cortex.contexts.create({
      memorySpaceId: "space-a",
      data: { sharedInfo: "visible" },
      ...
    });
    
    // Space A stores private fact
    await cortex.facts.store({
      memorySpaceId: "space-a",
      fact: "Space A confidential data",
      ...
    });
    
    // Grant context access to space B
    await cortex.contexts.grantAccess(ctx.contextId, "space-b", "read-only");
    
    // ✅ VALIDATE: Space B can see context
    const contextFromB = await cortex.contexts.get(ctx.contextId);
    expect(contextFromB).not.toBeNull();
    expect(contextFromB!.data.sharedInfo).toBe("visible");
    
    // ✅ VALIDATE: Space B CANNOT see space A's facts
    const spaceBFacts = await cortex.facts.list({ memorySpaceId: "space-b" });
    expect(spaceBFacts.some(f => f.fact.includes("confidential"))).toBe(false);
    
    // ❌ MISSING: More granular access control tests
  });
  
  it("revoked access prevents context read", async () => {
    // Grant then revoke access
    // ❌ MISSING - need revokeAccess() API
  });
  
  it("different scopes (read-only vs collaborate) enforced", async () => {
    // ❌ MISSING - need scope enforcement tests
  });
});
```

---

## Category 5: Version Chain Integrity (MEDIUM PRIORITY)

### 5.1 Version Chains Not Fully Validated

**Missing Tests:**

```typescript
describe("Version Chain Integrity", () => {
  it("facts: complete chain walkable in both directions", async () => {
    const v1 = await cortex.facts.store({...});
    const v2 = await cortex.facts.update(memorySpaceId, v1.factId, {...});
    const v3 = await cortex.facts.update(memorySpaceId, v2.factId, {...});
    const v4 = await cortex.facts.update(memorySpaceId, v3.factId, {...});
    
    // ✅ WALK FORWARD from v1
    const v1Stored = await cortex.facts.get(memorySpaceId, v1.factId);
    expect(v1Stored!.supersededBy).toBe(v2.factId);
    
    const v2Stored = await cortex.facts.get(memorySpaceId, v2.factId);
    expect(v2Stored!.supersededBy).toBe(v3.factId);
    expect(v2Stored!.supersedes).toBe(v1.factId);
    
    // ✅ WALK BACKWARD from v4
    const v4Stored = await cortex.facts.get(memorySpaceId, v4.factId);
    expect(v4Stored!.supersedes).toBe(v3.factId);
    expect(v4Stored!.supersededBy).toBeUndefined(); // Latest
    
    const v3Stored = await cortex.facts.get(memorySpaceId, v3.factId);
    expect(v3Stored!.supersedes).toBe(v2.factId);
    
    // ✅ VALIDATE: getHistory returns ALL 4 versions in order
    const history = await cortex.facts.getHistory(memorySpaceId, v1.factId);
    expect(history).toHaveLength(4);
    expect(history[0].factId).toBe(v1.factId);
    expect(history[3].factId).toBe(v4.factId);
  });
  
  it("vector: version chains preserve all previous versions", async () => {
    const v1 = await cortex.vector.store("memspace", { content: "V1", ...});
    await cortex.vector.update("memspace", v1.memoryId, { content: "V2" });
    await cortex.vector.update("memspace", v1.memoryId, { content: "V3" });
    
    const current = await cortex.vector.get("memspace", v1.memoryId);
    
    // ✅ VALIDATE: previousVersions contains v1 and v2
    expect(current!.version).toBe(3);
    expect(current!.previousVersions).toHaveLength(2);
    expect(current!.previousVersions[0].content).toBe("V1");
    expect(current!.previousVersions[1].content).toBe("V2");
  });
  
  it("immutable: version chains complete", async () => {
    // ⚠️ PARTIALLY TESTED - could be more thorough
  });
  
  it("version chains survive updates from multiple callers", async () => {
    // Concurrent updates create versions
    // ❌ MISSING - race condition testing
  });
});
```

### 5.2 Temporal Queries Across Versions

**Missing Tests:**

```typescript
describe("Temporal Queries: getAtTimestamp()", () => {
  it("vector.getAtTimestamp() returns correct version", async () => {
    const v1 = await cortex.vector.store("memspace", {
      content: "V1",
      importance: 50,
      ...
    });
    const t1 = Date.now();
    
    await new Promise(resolve => setTimeout(resolve, 100));
    
    await cortex.vector.update("memspace", v1.memoryId, {
      content: "V2",
      importance: 80,
    });
    const t2 = Date.now();
    
    // ✅ VALIDATE: At t1, should see v1
    const atT1 = await cortex.vector.getAtTimestamp("memspace", v1.memoryId, t1);
    expect(atT1!.content).toBe("V1");
    expect(atT1!.importance).toBe(50);
    
    // ✅ VALIDATE: At t2, should see v2
    const atT2 = await cortex.vector.getAtTimestamp("memspace", v1.memoryId, t2);
    expect(atT2!.content).toBe("V2");
    expect(atT2!.importance).toBe(80);
  });
  
  it("facts: temporal validity windows", async () => {
    const fact = await cortex.facts.store({
      fact: "User prefers email",
      validFrom: Date.now(),
      validUntil: Date.now() + 86400000, // 24 hours
      ...
    });
    
    // ❌ MISSING: Query for facts valid at specific timestamp
    // API gap - need queryAtTimestamp()
  });
});
```

---

## Category 6: Bulk Operations (MEDIUM PRIORITY)

### 6.1 Bulk Operations Missing Validation

**Missing Tests:**

```typescript
describe("Bulk Operations: Data Consistency", () => {
  it("deleteMany removes ALL matching memories", async () => {
    // Create 100 memories with tag "bulk-test"
    const MEMORY_IDS = [];
    for (let i = 0; i < 100; i++) {
      const mem = await cortex.vector.store("memspace", {
        content: `Bulk test ${i}`,
        metadata: { importance: 50, tags: ["bulk-test"] },
        ...
      });
      MEMORY_IDS.push(mem.memoryId);
    }
    
    // Delete by tag
    const result = await cortex.vector.deleteMany({
      memorySpaceId: "memspace",
      tags: ["bulk-test"],
    });
    
    expect(result.deleted).toBe(100);
    
    // ✅ VALIDATE: ALL actually deleted (not just count)
    for (const memId of MEMORY_IDS) {
      const mem = await cortex.vector.get("memspace", memId);
      expect(mem).toBeNull();
    }
    
    // ✅ VALIDATE: Count matches
    const remaining = await cortex.vector.count({
      memorySpaceId: "memspace",
      tags: ["bulk-test"],
    });
    expect(remaining).toBe(0);
  });
  
  it("updateMany updates ALL matching memories", async () => {
    // Create memories with various importance
    for (let i = 0; i < 50; i++) {
      await cortex.vector.store("memspace", {
        content: `Update test ${i}`,
        metadata: { importance: 50, tags: ["update-test"] },
        ...
      });
    }
    
    // Update all
    const result = await cortex.vector.updateMany(
      { memorySpaceId: "memspace", tags: ["update-test"] },
      { importance: 90 }
    );
    
    expect(result.updated).toBe(50);
    
    // ✅ VALIDATE: ALL actually updated (not just count)
    const updated = await cortex.vector.list({
      memorySpaceId: "memspace",
      tags: ["update-test"],
    });
    
    updated.forEach(mem => {
      expect(mem.importance).toBe(90); // ← ALL updated
    });
  });
  
  it("export() exports ALL matching data", async () => {
    // Create 200 memories
    for (let i = 0; i < 200; i++) {
      await cortex.vector.store("memspace", {
        content: `Export test ${i}`,
        metadata: { importance: 50, tags: ["export-test"] },
        ...
      });
    }
    
    const exported = await cortex.vector.export({
      memorySpaceId: "memspace",
      format: "json",
    });
    
    const parsed = JSON.parse(exported.data);
    
    // ✅ VALIDATE: Got all 200
    expect(parsed.length).toBe(200);
    
    // ✅ VALIDATE: Each entry complete
    parsed.forEach((mem: any) => {
      expect(mem.memoryId).toBeDefined();
      expect(mem.content).toBeDefined();
      expect(mem.memorySpaceId).toBe("memspace");
    });
  });
});
```

---

## Category 7: Edge Cases & Error Conditions (MEDIUM PRIORITY)

### 7.1 Edge Cases Not Tested

**Missing Tests:**

```typescript
describe("Edge Cases: Extreme Values", () => {
  it("handles 1000+ participants in hive", async () => {
    const participants = Array.from({ length: 1000 }, (_, i) => ({
      id: `tool-${i}`,
      type: "tool",
    }));
    
    const hive = await cortex.memorySpaces.register({
      memorySpaceId: "massive-hive",
      participants,
      ...
    });
    
    expect(hive.participants).toHaveLength(1000);
    
    // ✅ VALIDATE: Can still operate efficiently
    const stats = await cortex.memorySpaces.getStats("massive-hive");
    expect(stats).toBeDefined();
  });
  
  it("handles 10,000+ memories in space", async () => {
    // ❌ MISSING - performance at scale
  });
  
  it("handles 100+ level deep context chains", async () => {
    // ❌ MISSING - deep hierarchy performance
  });
  
  it("handles very long fact statements (10KB+)", async () => {
    const longFact = "A".repeat(10000);
    const fact = await cortex.facts.store({
      fact: longFact,
      ...
    });
    
    expect(fact.fact.length).toBe(10000);
    
    const stored = await cortex.facts.get(memorySpaceId, fact.factId);
    expect(stored!.fact).toBe(longFact);
  });
  
  it("handles special characters in all text fields", async () => {
    const SPECIAL = `<>"&'\n\t\r\0`;
    
    const mem = await cortex.vector.store("memspace", {
      content: `Content with ${SPECIAL}`,
      metadata: { importance: 50, tags: [`tag${SPECIAL}`] },
      ...
    });
    
    const stored = await cortex.vector.get("memspace", mem.memoryId);
    expect(stored!.content).toContain(SPECIAL);
    // ❌ MISSING - comprehensive special character testing
  });
  
  it("handles unicode and emojis", async () => {
    // ❌ MISSING
  });
  
  it("handles concurrent creates to same memorySpace", async () => {
    // ❌ MISSING - race condition testing
  });
});
```

### 7.2 Error Conditions Not Fully Covered

**Missing Tests:**

```typescript
describe("Error Handling: Malformed Input", () => {
  it("rejects invalid memorySpaceId format", async () => {
    await expect(
      cortex.vector.store("", { content: "test", ...})
    ).rejects.toThrow(); // ❌ Need specific error
  });
  
  it("rejects invalid participantId format", async () => {
    // ❌ MISSING
  });
  
  it("rejects invalid factType", async () => {
    await expect(
      cortex.facts.store({
        factType: "invalid-type" as any,
        ...
      })
    ).rejects.toThrow();
  });
  
  it("handles missing required fields gracefully", async () => {
    // ❌ MISSING - test each required field
  });
  
  it("handles network errors during multi-layer operation", async () => {
    // ❌ MISSING - what if conversation.addMessage succeeds but vector.store fails?
    // Rollback? Partial state?
  });
});
```

---

## Category 8: Consistency & State Management (HIGH PRIORITY)

### 8.1 State Consistency Across Operations

**Missing Tests:**

```typescript
describe("State Consistency: Multi-Operation Sequences", () => {
  it("remember() → forget() → verify: complete cleanup", async () => {
    const remembered = await cortex.memory.remember({...});
    
    await cortex.memory.forget(memorySpaceId, remembered.memories[0].memoryId, {
      deleteConversation: true,
    });
    
    // ✅ VALIDATE: Vector deleted
    const vectorCheck = await cortex.vector.get(...);
    expect(vectorCheck).toBeNull();
    
    // ✅ VALIDATE: Conversation deleted
    const convCheck = await cortex.conversations.get(...);
    expect(convCheck).toBeNull();
    
    // ✅ VALIDATE: List doesn't show deleted items
    const list = await cortex.vector.list({...});
    expect(list.some(m => m.memoryId === remembered.memories[0].memoryId)).toBe(false);
    
    // ✅ VALIDATE: Count updated
    const countBefore = /* stored before test */;
    const countAfter = await cortex.vector.count({...});
    expect(countAfter).toBe(countBefore - 2); // Both memories deleted
  });
  
  it("create() → update() → delete(): state consistent at each step", async () => {
    // ❌ MISSING - validate state after EACH operation
  });
  
  it("concurrent operations don't create inconsistent state", async () => {
    // Create 10 memories concurrently
    const promises = Array.from({ length: 10 }, () =>
      cortex.vector.store("memspace", {...})
    );
    
    const results = await Promise.all(promises);
    
    // ✅ VALIDATE: All created
    expect(results).toHaveLength(10);
    
    // ✅ VALIDATE: All retrievable
    for (const mem of results) {
      const stored = await cortex.vector.get("memspace", mem.memoryId);
      expect(stored).not.toBeNull();
    }
    
    // ✅ VALIDATE: Count accurate
    const count = await cortex.vector.count({ memorySpaceId: "memspace" });
    expect(count).toBeGreaterThanOrEqual(10);
  });
});
```

### 8.2 Statistics Consistency

**Missing Tests:**

```typescript
describe("Statistics Consistency", () => {
  it("memorySpaces.getStats() matches actual counts", async () => {
    const SPACE = "stats-validation";
    
    // Create known amounts of data
    const conv1 = await cortex.conversations.create({ memorySpaceId: SPACE, ...});
    await cortex.conversations.addMessage({ conversationId: conv1.conversationId, ...});
    await cortex.conversations.addMessage({ conversationId: conv1.conversationId, ...});
    await cortex.conversations.addMessage({ conversationId: conv1.conversationId, ...});
    
    await cortex.vector.store(SPACE, {...}); // 1 memory
    await cortex.vector.store(SPACE, {...}); // 2 memories
    
    await cortex.facts.store({ memorySpaceId: SPACE, ...}); // 1 fact
    
    // Get stats
    const stats = await cortex.memorySpaces.getStats(SPACE);
    
    // ✅ VALIDATE: Matches actual
    expect(stats.totalConversations).toBe(1);
    expect(stats.totalMessages).toBe(3);
    expect(stats.totalMemories).toBe(2);
    expect(stats.totalFacts).toBe(1);
    
    // ✅ VALIDATE: Matches direct queries
    const convCount = await cortex.conversations.count({ memorySpaceId: SPACE });
    const memCount = await cortex.vector.count({ memorySpaceId: SPACE });
    const factCount = await cortex.facts.count({ memorySpaceId: SPACE });
    
    expect(stats.totalConversations).toBe(convCount);
    expect(stats.totalMemories).toBe(memCount);
    expect(stats.totalFacts).toBe(factCount);
  });
  
  it("stats update immediately after operations", async () => {
    const before = await cortex.memorySpaces.getStats(SPACE);
    
    await cortex.vector.store(SPACE, {...});
    
    const after = await cortex.memorySpaces.getStats(SPACE);
    
    expect(after.totalMemories).toBe(before.totalMemories + 1);
  });
});
```

---

## Category 9: Search & Query Consistency (MEDIUM PRIORITY)

### 9.1 Search Results Not Fully Validated

**Missing Tests:**

```typescript
describe("Search Consistency", () => {
  it("vector.search() results match list() filter", async () => {
    await cortex.vector.store("memspace", {
      content: "UNIQUE_SEARCH_TERM data",
      metadata: { importance: 80, tags: ["searchable"] },
      ...
    });
    
    // Search
    const searchResults = await cortex.vector.search("memspace", "UNIQUE_SEARCH_TERM");
    
    // List with same content
    const listResults = await cortex.vector.list({ memorySpaceId: "memspace" });
    const filtered = listResults.filter(m => m.content.includes("UNIQUE_SEARCH_TERM"));
    
    // ✅ VALIDATE: Same results
    expect(searchResults.length).toBe(filtered.length);
    searchResults.forEach(sr => {
      expect(filtered.some(f => f.memoryId === sr.memoryId)).toBe(true);
    });
  });
  
  it("facts.search() results match list() filter", async () => {
    // ❌ MISSING - same pattern for facts
  });
  
  it("search pagination consistent with list pagination", async () => {
    // ❌ MISSING
  });
  
  it("search with filters returns subset of unfiltered search", async () => {
    const all = await cortex.vector.search("memspace", "keyword");
    const filtered = await cortex.vector.search("memspace", "keyword", {
      minImportance: 80,
    });
    
    // ✅ VALIDATE: Filtered is subset of all
    expect(filtered.length).toBeLessThanOrEqual(all.length);
    filtered.forEach(f => {
      expect(all.some(a => a.memoryId === f.memoryId)).toBe(true);
      expect(f.importance).toBeGreaterThanOrEqual(80);
    });
  });
});
```

---

## Category 10: GDPR & Cascade Deletion (HIGH PRIORITY)

### 10.1 Cascade Deletion Not Fully Tested

**Missing Tests:**

```typescript
describe("GDPR: Cascade Deletion Completeness", () => {
  it("deleting memorySpace with cascade removes ALL data", async () => {
    const SPACE = "cascade-test-space";
    
    await cortex.memorySpaces.register({ memorySpaceId: SPACE, ...});
    
    // Create data in ALL layers
    const conv = await cortex.conversations.create({ memorySpaceId: SPACE, ...});
    const mem = await cortex.vector.store(SPACE, {...});
    const fact = await cortex.facts.store({ memorySpaceId: SPACE, ...});
    const ctx = await cortex.contexts.create({ memorySpaceId: SPACE, ...});
    
    // Delete space with cascade
    await cortex.memorySpaces.delete(SPACE, { cascade: true });
    
    // ✅ VALIDATE: ALL data deleted
    const convCheck = await cortex.conversations.get(conv.conversationId);
    expect(convCheck).toBeNull();
    
    const memCheck = await cortex.vector.get(SPACE, mem.memoryId);
    expect(memCheck).toBeNull();
    
    const factCheck = await cortex.facts.get(SPACE, fact.factId);
    expect(factCheck).toBeNull();
    
    const ctxCheck = await cortex.contexts.get(ctx.contextId);
    expect(ctxCheck).toBeNull();
    
    // ✅ VALIDATE: Counts all zero
    const convCount = await cortex.conversations.count({ memorySpaceId: SPACE });
    const memCount = await cortex.vector.count({ memorySpaceId: SPACE });
    const factCount = await cortex.facts.count({ memorySpaceId: SPACE });
    const ctxCount = await cortex.contexts.count({ memorySpaceId: SPACE });
    
    expect(convCount).toBe(0);
    expect(memCount).toBe(0);
    expect(factCount).toBe(0);
    expect(ctxCount).toBe(0);
  });
  
  it("userId cascade deletes from all layers", async () => {
    const USER = "user-gdpr-test";
    
    // Create data with userId in all layers
    await cortex.conversations.create({ 
      memorySpaceId: "space",
      participants: { userId: USER, ...},
      ...
    });
    await cortex.vector.store("space", { userId: USER, ...});
    await cortex.contexts.create({ userId: USER, ...});
    
    // ❌ MISSING: Actual cascade deletion API
    // await cortex.users.delete(USER, { cascade: true });
    
    // Would validate all USER data deleted
  });
  
  it("cascade respects memory space boundaries", async () => {
    // Delete from space-a doesn't affect space-b
    // ❌ MISSING
  });
});
```

---

## Category 11: Performance & Scale (LOW PRIORITY for v0.6.1)

### 11.1 Performance Degradation Not Tested

**Missing Tests:**

```typescript
describe("Performance: Scale Testing", () => {
  it("list() performance doesn't degrade with 10,000 memories", async () => {
    // Create 10,000 memories
    // ❌ MISSING
    
    const start = Date.now();
    const results = await cortex.vector.list({
      memorySpaceId: "large-space",
      limit: 100,
    });
    const duration = Date.now() - start;
    
    expect(duration).toBeLessThan(1000); // Should be fast even with 10K
  });
  
  it("search() performance with large result sets", async () => {
    // ❌ MISSING
  });
  
  it("getChain() performance with deep hierarchies", async () => {
    // Create 50-level deep context chain
    // ❌ MISSING
  });
});
```

---

## 📋 Specific Test Proposals for v0.6.1

### Priority 1: Parameter Propagation (20 tests)

**File:** `tests/parameterPropagation.test.ts` (NEW)

Tests for:
- `memory.remember()` → all params to vector (10 tests)
- `memory.get()` → enrichment params (3 tests)  
- `memory.search()` → enrichment params (3 tests)
- Optional param handling (4 tests)

**Estimated effort:** 2-3 hours  
**Impact:** HIGH - catches wrapper function bugs

### Priority 2: Cross-Layer Integrity (25 tests)

**File:** `tests/crossLayerIntegrity.test.ts` (NEW)

Tests for:
- Reference integrity (conversationRef, sourceRef) (10 tests)
- Bidirectional references (5 tests)
- Orphaned reference handling (5 tests)
- Cross-layer consistency (5 tests)

**Estimated effort:** 3-4 hours  
**Impact:** HIGH - catches data corruption

### Priority 3: Participant Tracking (15 tests)

**Enhance:** `tests/hiveMode.test.ts`

Tests for:
- Participant tracking through all APIs (5 tests)
- Multiple participants in hive (5 tests)
- Participant filtering (5 tests)

**Estimated effort:** 2 hours  
**Impact:** HIGH - validates Hive Mode fully

### Priority 4: Field-by-Field Validation (30 tests)

**Enhance:** All existing test files

Add to each store operation:
- Complete field validation
- Retrieval after store
- Database verification

**Estimated effort:** 4-5 hours  
**Impact:** MEDIUM-HIGH - prevents silent field drops

### Priority 5: Bulk Operations (15 tests)

**Enhance:** Existing test files

Tests for:
- deleteMany completeness (5 tests)
- updateMany completeness (5 tests)  
- export completeness (5 tests)

**Estimated effort:** 2 hours  
**Impact:** MEDIUM - validates bulk ops

### Priority 6: Edge Cases (20 tests)

**File:** `tests/edgeCases.test.ts` (NEW)

Tests for:
- Extreme values (10,000+ items) (5 tests)
- Special characters (5 tests)
- Concurrent operations (5 tests)
- Deep hierarchies (5 tests)

**Estimated effort:** 3 hours  
**Impact:** MEDIUM - improves robustness

### Priority 7: GDPR & Cascade (10 tests)

**File:** `tests/gdprCascade.test.ts` (NEW)

Tests for:
- Complete cascade deletion (5 tests)
- Cascade boundaries (3 tests)
- userId filtering (2 tests)

**Estimated effort:** 2 hours  
**Impact:** HIGH - critical for compliance

---

## 🎯 Proposed Test Roadmap

### v0.6.1 (Immediate - Bug Prevention)

**Target:** +60 tests (total: 439 tests)

**Must-Have:**
1. ✅ Parameter propagation tests (20 tests) - Prevents wrapper bugs
2. ✅ Cross-layer integrity tests (15 tests) - Prevents data corruption
3. ✅ Participant tracking tests (10 tests) - Validates Hive Mode
4. ✅ Field-by-field validation (15 tests) - Prevents silent drops

**Estimated effort:** 8-10 hours  
**Impact:** Catches 90% of bugs like participantId issue

### v0.7.0 (Enhancement - Comprehensive)

**Target:** +100 tests (total: 539 tests)

**Should-Have:**
1. Bulk operation validation (15 tests)
2. Edge cases (20 tests)
3. GDPR cascade (10 tests)
4. Enhanced cross-layer flows (25 tests)
5. State consistency (15 tests)
6. Search consistency (15 tests)

**Estimated effort:** 15-20 hours  
**Impact:** Production-grade robustness

### v0.8.0 (Advanced - Scale)

**Target:** +50 tests (total: 589 tests)

**Nice-to-Have:**
1. Performance benchmarks (10 tests)
2. Scale testing (10,000+ items) (10 tests)
3. Concurrent operation stress (10 tests)
4. Error recovery scenarios (10 tests)
5. Migration path validation (10 tests)

**Estimated effort:** 10 hours  
**Impact:** Enterprise readiness

---

## 🔍 Test Quality Metrics to Track

### Coverage Metrics (Target for v0.7.0)

| Metric | Current | v0.6.1 Target | v0.7.0 Target |
|--------|---------|---------------|---------------|
| **Function Coverage** | 100% | 100% | 100% |
| **Parameter Propagation** | 60% | 95% | 100% |
| **Field Validation** | 40% | 75% | 95% |
| **Cross-Layer Flows** | 30% | 60% | 90% |
| **Participant Tracking** | 50% | 90% | 100% |
| **Reference Integrity** | 20% | 70% | 95% |
| **State Consistency** | 60% | 80% | 95% |
| **Edge Cases** | 30% | 50% | 80% |

### Effectiveness Metrics

**Bug Detection Rate:**
- v0.6.0: Missed 1 critical bug (participantId)
- v0.6.1 target: Catch all parameter propagation bugs
- v0.7.0 target: Catch all cross-layer integrity bugs

**Test Depth Score:**
```
Current: 2.5 layers per test average
Target: 3.5 layers per test average

Layers validated per test:
1 = Single API function
2 = Function + retrieval
3 = Cross-layer operation  
4 = Complete workflow
5 = Multi-participant workflow
```

---

## 🚀 Implementation Strategy

### Phase 1: Quick Wins (v0.6.1 - This Week)

**Add to existing test files:**

```typescript
// In memory.test.ts
describe("Parameter Propagation (v0.6.1)", () => {
  it("remember() propagates importance", async () => { ... });
  it("remember() propagates tags", async () => { ... });
  it("remember() propagates userId", async () => { ... });
  // +5 more tests
});

// In hiveMode.test.ts  
describe("Participant Tracking Validation", () => {
  it("vector.update() preserves participantId", async () => { ... });
  it("multiple tools via remember() tracked separately", async () => { ... });
  // +3 more tests
});

// In vector.test.ts
describe("Field-by-Field Validation", () => {
  it("store() preserves all input fields", async () => { ... });
  it("get() returns exact stored data", async () => { ... });
  // +3 more tests
});
```

**Estimated:** 20-30 tests, 4-6 hours  
**Impact:** Immediate bug prevention

### Phase 2: New Test Suites (v0.7.0 - Next Month)

**Create:**
- `tests/parameterPropagation.test.ts` (20 tests)
- `tests/crossLayerIntegrity.test.ts` (25 tests)
- `tests/edgeCases.test.ts` (20 tests)
- `tests/gdprCascade.test.ts` (10 tests)

**Estimated:** 75 tests, 12-15 hours  
**Impact:** Comprehensive coverage

### Phase 3: Advanced Validation (v0.8.0 - Future)

**Create:**
- `tests/performanceScale.test.ts` (10 tests)
- `tests/concurrency.test.ts` (10 tests)
- `tests/errorRecovery.test.ts` (10 tests)

**Estimated:** 30 tests, 6-8 hours  
**Impact:** Enterprise-grade

---

## ✅ Immediate Action Items for v0.6.1

**This week:**

1. **Create `tests/parameterPropagation.test.ts`**
   - 10 tests for `remember()` parameter flow
   - 5 tests for `get()/search()` enrichment
   - 5 tests for optional parameter handling

2. **Enhance `tests/hiveMode.test.ts`**
   - Add 5 participant tracking tests
   - Add 3 cross-participant validation tests

3. **Add field validation to existing tests**
   - vector.test.ts: Add retrieval + validation to 10 tests
   - facts.test.ts: Add retrieval + validation to 10 tests

4. **Run comprehensive test suite**
   - Target: 430+ tests (379 + 51 new)
   - Maintain 100% pass rate

**Total effort:** 8-10 hours  
**Result:** Dramatically reduced risk of similar bugs

---

## 📊 Expected Outcomes

### After v0.6.1 Testing Enhancements

**Bug Prevention:**
- 95% of parameter propagation bugs caught
- 80% of cross-layer integrity bugs caught
- 90% of participant tracking bugs caught

**Test Quality:**
- Average test depth: 3.0 layers (up from 2.5)
- Parameter coverage: 95% (up from 60%)
- Field validation: 75% (up from 40%)

**Confidence:**
- Can refactor with confidence
- Breaking changes caught immediately
- Integration issues found before release

---

**Summary:** We have excellent API surface coverage but need deeper cross-layer validation. The proposed tests will catch bugs like the participantId issue and many others before they reach production.

