# Security & Privacy

> **Last Updated**: 2025-10-28

Data protection, access control, GDPR compliance, and security best practices.

## Overview

Cortex is designed with **privacy-first architecture** and **security by default**. All data is isolated, access is controlled, and GDPR compliance is built-in.

**Core Security Principles:**

1. **Agent Isolation** - Agents cannot access each other's memories
2. **User Data Protection** - userId enables GDPR cascade deletion
3. **Immutable Audit Trail** - ACID conversations never modified
4. **No PII in Embeddings** - Vectors can be public, source data protected
5. **Convex ACID** - Transaction guarantees prevent corruption

---

## Data Isolation

### Agent-Level Isolation

**Enforcement:** All queries filter by `agentId` at the index level.

```typescript
// Agent 1's memories
await cortex.memory.store('agent-1', {
  content: 'Secret data for agent-1',
  ...
});

// Agent 2 CANNOT access
const memories = await cortex.memory.search('agent-2', 'secret');
// Returns: [] (empty - different agent) ✅

// Convex query automatically filters
await ctx.db
  .query("memories")
  .withIndex("by_agent", (q) => q.eq("agentId", "agent-2"))  // ← Isolated
  .collect();
// Never sees agent-1's data
```

**Guarantees:**

- ✅ Database-level isolation (Convex indexes)
- ✅ No cross-agent queries possible
- ✅ SDK enforces agentId in all operations
- ✅ Cannot accidentally leak data

### User-Level Isolation

```typescript
// User A's data
await cortex.memory.store('agent-1', {
  content: 'User A prefers dark mode',
  userId: 'user-a',
  ...
});

// User B's data
await cortex.memory.store('agent-1', {
  content: 'User B prefers light mode',
  userId: 'user-b',
  ...
});

// Query with userId filter
const userAMemories = await cortex.memory.search('agent-1', 'preferences', {
  userId: 'user-a',  // ← Only user-a's data
});

// User B's data never returned ✅
```

---

## Access Control

### SDK-Level Enforcement

```typescript
// Cortex SDK enforces ownership
class CortexSDK {
  async get(memorySpaceId: string, memoryId: string) {
    const memory = await this.client.query(api.memories.get, {
      agentId,
      memoryId,
    });

    // Server verifies ownership
    if (memory.agentId !== agentId) {
      throw new CortexError("PERMISSION_DENIED");
    }

    return memory;
  }
}
```

### Convex Function Enforcement

```typescript
// Server-side validation
export const get = query({
  args: { memorySpaceId: v.string(), memoryId: v.id("memories") },
  handler: async (ctx, args) => {
    const memory = await ctx.db.get(args.memoryId);

    if (!memory) {
      return null;
    }

    // Verify agent owns this memory
    if (memory.agentId !== args.agentId) {
      throw new Error("PERMISSION_DENIED");
    }

    return memory;
  },
});
```

### Application-Level Auth

```typescript
// Add authentication layer
async function storeMemoryWithAuth(
  userId: string,
  memorySpaceId: string,
  data: MemoryInput,
) {
  // Verify user owns this agent
  const agent = await cortex.agents.get(agentId);

  if (agent.metadata.ownerId !== userId) {
    throw new Error("Unauthorized: User does not own this agent");
  }

  // Proceed
  return await cortex.memory.store(agentId, data);
}
```

---

## GDPR Compliance

### Data Minimization

**Principle:** Only store what's necessary.

```typescript
// ❌ Don't store unnecessary PII
await cortex.users.update("user-123", {
  data: {
    ssn: "123-45-6789", // ❌ Never store
    creditCard: "4111...", // ❌ Never store
    fullAddress: "...", // ❌ Avoid if possible
  },
});

// ✅ Store minimal PII
await cortex.users.update("user-123", {
  data: {
    displayName: "Alex", // ✅ Minimal
    email: "alex@example.com", // ✅ If needed
    preferences: { theme: "dark" }, // ✅ Non-PII
  },
});

// ✅ Store references, not raw data
await cortex.users.update("user-123", {
  data: {
    paymentMethodId: "pm_abc123", // ✅ Stripe reference
    addressId: "addr_xyz", // ✅ Reference to separate system
  },
});
```

### Right to Access

```typescript
// Export all user data (GDPR Article 15)
const userData = await cortex.users.export(
  {
    email: "alex@example.com",
  },
  {
    format: "json",
    includeMemories: true, // All agent memories
    includeConversations: true, // ACID conversations
    includeVersionHistory: true, // Version history
  },
);

// Returns complete data package for user
```

### Right to Be Forgotten

```typescript
// Cloud Mode: One-click deletion
const result = await cortex.users.delete("user-123", {
  cascade: true, // Delete from ALL stores
  auditReason: "GDPR right to be forgotten request",
});

console.log(`Deleted ${result.totalRecordsDeleted} records`);
// From: conversations, immutable, mutable, vector ✅

// Direct Mode: Manual deletion
// (See User Operations API for complete example)
```

### Data Retention

```typescript
// GDPR: Don't keep data longer than necessary
await cortex.governance.setPolicy({
  conversations: {
    retention: {
      deleteAfter: "7y", // GDPR typical maximum
      archiveAfter: "1y", // Move to cold storage
    },
  },

  immutable: {
    retention: {
      defaultVersions: 20,
      byType: {
        "user-feedback": { versionsToKeep: 5 }, // Less retention
      },
    },
  },

  vector: {
    retention: {
      defaultVersions: 10,
      byImportance: [
        { range: [0, 30], versions: 1 }, // Minimal for trivial
        { range: [70, 100], versions: 20 }, // More for important
      ],
    },
  },
});
```

---

## Sensitive Data Handling

### Don't Store Secrets in Content

```typescript
// ❌ BAD: Plaintext secrets in content
await cortex.memory.store('agent-1', {
  content: 'User password is: MySecret123',  // ❌ Never!
  ...
});

// ✅ GOOD: Store references only
await cortex.memory.store('agent-1', {
  content: 'User updated password on 2025-10-25',  // ✅ Event only
  metadata: {
    passwordUpdated: true,
    updateTimestamp: new Date(),
    // No actual password stored
  },
});

// ✅ GOOD: Hash if you must store
import { hash } from 'bcrypt';

await cortex.memory.store('agent-1', {
  content: 'User password set',
  metadata: {
    passwordHash: await hash('MySecret123', 10),  // ✅ Hashed
  },
});
```

### Separate Sensitive Data

```typescript
// ✅ Store sensitive data in secure vault (not Cortex)
await vault.store("user-123-credentials", {
  password: encrypted,
  apiKeys: encrypted,
});

// Store reference in Cortex
await cortex.memory.store("agent-1", {
  content: "User credentials stored in vault",
  metadata: {
    vaultRef: "user-123-credentials", // ✅ Reference only
  },
});
```

---

## Encryption

### At-Rest Encryption (Convex)

**Convex provides:**

- ✅ Encryption at rest (AES-256)
- ✅ Encrypted backups
- ✅ Secure key management

**You get automatically:**

- All data encrypted on disk
- Backups encrypted
- No additional configuration needed

### In-Transit Encryption

**Convex provides:**

- ✅ TLS 1.3 for all connections
- ✅ HTTPS API endpoints
- ✅ WebSocket encryption

**Your responsibility:**

- Use HTTPS URLs only
- Don't disable TLS
- Validate certificates

### Application-Level Encryption (Optional)

```typescript
// Encrypt before storing (if needed)
import { encrypt, decrypt } from "./crypto";

// Store encrypted content
await cortex.memory.store("agent-1", {
  content: await encrypt("Sensitive information"), // ← Encrypted
  metadata: {
    encrypted: true,
    algorithm: "AES-256-GCM",
  },
});

// Decrypt on retrieval
const memory = await cortex.memory.get("agent-1", memoryId);
const decrypted = memory.metadata.encrypted
  ? await decrypt(memory.content)
  : memory.content;
```

**When to use:**

- Highly sensitive data (medical, financial)
- Regulatory requirements (HIPAA, PCI-DSS)
- Zero-trust architecture
- Convex-level encryption isn't enough

---

## Audit Logging

### ACID Conversations as Audit Trail

```typescript
// Every conversation is an immutable audit log
const conversation = await cortex.conversations.get("conv-123");

console.log("Complete audit trail:");
conversation.messages.forEach((msg) => {
  console.log(`${msg.timestamp}: ${msg.role} - ${msg.content}`);
});

// Compliance:
// ✅ Never modified (immutable)
// ✅ Complete history (append-only)
// ✅ Timestamped (when)
// ✅ Attributed (who)
```

### Version History as Audit

```typescript
// Track how information changed
const memory = await cortex.memory.get("agent-1", memoryId);

console.log("Audit trail:");
console.log(`Current (v${memory.version}): ${memory.content}`);

memory.previousVersions.forEach((v) => {
  console.log(`v${v.version} (${new Date(v.timestamp)}): ${v.content}`);
});

// Shows:
// - What changed
// - When it changed
// - Why it changed (if updatedBy set)
```

### Deletion Audit

```typescript
// Log all deletions
export const deleteWithAudit = mutation({
  args: {
    memorySpaceId: v.string(),
    memoryId: v.id("memories"),
    reason: v.string(),
  },
  handler: async (ctx, args) => {
    const memory = await ctx.db.get(args.memoryId);

    // Log deletion (immutable audit log)
    await ctx.db.insert("auditLogs", {
      action: "DELETE_MEMORY",
      memorySpaceId: args.agentId,
      memoryId: args.memoryId,
      content: memory.content, // Preserve for audit
      reason: args.reason,
      performedAt: Date.now(),
      performedBy: ctx.auth?.userId, // From auth context
    });

    // Delete memory
    await ctx.db.delete(args.memoryId);

    return { deleted: true };
  },
});
```

---

## Multi-Tenant Security

### Tenant Isolation

```typescript
// Include tenant in userId
const userId = `${tenantId}:${userLocalId}`;

await cortex.users.update(userId, {
  data: {
    displayName: "Alex",
    tenantId, // ← Explicit tenant
  },
});

// Query by tenant
const tenantUsers = await cortex.users.search({
  "data.tenantId": tenantId,
});

// GDPR cascade respects tenant boundaries
await cortex.users.delete(userId, { cascade: true });
// Only deletes data for this tenant's user ✅
```

### Row-Level Security (Application)

```typescript
// Implement in your application layer
async function getUserMemories(
  requestingUserId: string,
  targetUserId: string,
  memorySpaceId: string,
) {
  // Verify access
  if (requestingUserId !== targetUserId) {
    // Check if user has permission
    const canAccess = await checkPermission(requestingUserId, targetUserId);

    if (!canAccess) {
      throw new Error("PERMISSION_DENIED");
    }
  }

  // Proceed
  return await cortex.memory.search(agentId, "*", {
    userId: targetUserId,
  });
}
```

---

## Compliance Features

### GDPR (General Data Protection Regulation)

**Cortex provides:**

✅ **Right to Access** - `cortex.users.export()`  
✅ **Right to Be Forgotten** - `cortex.users.delete({ cascade: true })` (Cloud Mode)  
✅ **Data Minimization** - Flexible schemas, store only what's needed  
✅ **Data Portability** - JSON/CSV export  
✅ **Audit Trail** - Immutable conversation history  
✅ **Retention Limits** - Configurable via governance policies  
✅ **Consent Tracking** - Store in user profile metadata

### HIPAA (Healthcare)

**Cortex supports:**

✅ **Encryption** - At-rest (Convex) + in-transit (TLS)  
✅ **Access Logs** - Audit trail in ACID conversations  
✅ **Data Integrity** - Versioning prevents tampering  
✅ **Minimum Necessary** - Selective data storage  
✅ **Retention** - Governance policies

**Additional requirements:**

- ⚠️ Business Associate Agreement (BAA) with Convex
- ⚠️ Application-level encryption (if needed)
- ⚠️ Access control (implement in your application)

### SOC 2

**Cortex helps with:**

✅ **Availability** - Convex uptime SLAs  
✅ **Security** - Encryption, access control  
✅ **Integrity** - ACID guarantees, versioning  
✅ **Confidentiality** - Agent isolation  
✅ **Privacy** - GDPR features

---

## Input Validation

### Server-Side Validation

```typescript
export const store = mutation({
  args: {
    memorySpaceId: v.string(),
    content: v.string(),
    metadata: v.any(),
  },
  handler: async (ctx, args) => {
    // Validate agentId
    if (!args.agentId || args.agentId.length === 0) {
      throw new Error("INVALID_AGENT_ID");
    }

    // Validate content
    if (!args.content || args.content.length === 0) {
      throw new Error("INVALID_CONTENT");
    }

    if (args.content.length > 100000) {
      // 100KB limit
      throw new Error("CONTENT_TOO_LARGE");
    }

    // Validate importance
    if (args.metadata.importance < 0 || args.metadata.importance > 100) {
      throw new Error("INVALID_IMPORTANCE");
    }

    // Sanitize content (prevent injection)
    const sanitized = sanitizeContent(args.content);

    // Store
    return await ctx.db.insert("memories", {
      ...args,
      content: sanitized,
    });
  },
});
```

### Embedding Validation

```typescript
// Validate embedding dimension
export const store = mutation({
  handler: async (ctx, args) => {
    if (args.embedding) {
      const expectedDim = 3072; // From schema

      if (args.embedding.length !== expectedDim) {
        throw new Error(
          `INVALID_EMBEDDING_DIMENSION: Expected ${expectedDim}, got ${args.embedding.length}`,
        );
      }

      // Validate values are numbers
      if (!args.embedding.every((v) => typeof v === "number")) {
        throw new Error("INVALID_EMBEDDING: Must be array of numbers");
      }
    }

    // Proceed...
  },
});
```

---

## Data Sanitization

### Content Sanitization

```typescript
import DOMPurify from "isomorphic-dompurify";

function sanitizeContent(content: string): string {
  // Remove HTML/script injection
  const cleaned = DOMPurify.sanitize(content, {
    ALLOWED_TAGS: [], // No HTML
    ALLOWED_ATTR: [],
  });

  // Trim
  return cleaned.trim();
}
```

### Metadata Sanitization

```typescript
function sanitizeMetadata(metadata: any): any {
  // Remove potentially dangerous fields
  const dangerous = ["__proto__", "constructor", "prototype"];

  const cleaned = { ...metadata };

  for (const key of dangerous) {
    delete cleaned[key];
  }

  return cleaned;
}
```

---

## Secure Defaults

### 1. No Cross-Agent Access

```typescript
// Default: Agent isolation enforced
// No way to query another agent's data

// If you NEED cross-agent access, explicit permission required
async function crossAgentSearch(
  requestingAgent: string,
  targetAgent: string,
  query: string,
) {
  // Check permission
  const allowed = await checkCrossAgentPermission(requestingAgent, targetAgent);

  if (!allowed) {
    throw new Error("PERMISSION_DENIED");
  }

  return await cortex.memory.search(targetAgent, query);
}
```

### 2. userId Required for User Data

```typescript
// Enforce userId for user-related data
export const store = mutation({
  handler: async (ctx, args) => {
    if (args.source.type === "conversation") {
      // User conversation must have userId
      if (!args.userId) {
        throw new Error("USERID_REQUIRED_FOR_CONVERSATION");
      }
    }

    // If userId provided, verify user exists
    if (args.userId) {
      const user = await ctx.db
        .query("immutable")
        .withIndex("by_type_id", (q) =>
          q.eq("type", "user").eq("id", args.userId),
        )
        .first();

      if (!user) {
        throw new Error("USER_NOT_FOUND");
      }
    }

    // Proceed...
  },
});
```

### 3. Immutable ACID Conversations

```typescript
// Conversations are append-only (no modification)
export const addMessage = mutation({
  handler: async (ctx, args) => {
    const conversation = await ctx.db.get(args.conversationId);

    // Can only APPEND, never modify existing messages
    await ctx.db.patch(args.conversationId, {
      messages: [...conversation.messages, args.newMessage], // ← Append
      // Cannot modify existing messages!
    });
  },
});

// No updateMessage() function exists
// No deleteMessage() function exists
// Guarantees immutable audit trail ✅
```

---

## Attack Prevention

### SQL Injection (N/A)

Convex uses TypeScript queries, not SQL:

```typescript
// No SQL injection possible (not using SQL)
const agentId = req.body.agentId; // User input

// ✅ Safe: TypeScript query
await ctx.db
  .query("memories")
  .withIndex("by_agent", (q) => q.eq("agentId", agentId))
  .collect();
// Convex handles sanitization ✅
```

### NoSQL Injection

```typescript
// Validate types
export const query = query({
  args: {
    memorySpaceId: v.string(), // ← Type validation
    filters: v.object({
      importance: v.number(), // ← Must be number
    }),
  },
  handler: async (ctx, args) => {
    // args are validated by Convex
    // Cannot inject via filters
  },
});

// ❌ This would be rejected:
await cortex.memory.search("agent-1", query, {
  filters: {
    importance: { $gt: 0, $lt: { $evil: "injection" } }, // ❌ Rejected by v.number()
  },
});
```

### Rate Limiting

```typescript
// Implement rate limiting for API calls
import { RateLimiter } from "@convex-dev/rate-limiter";

const limiter = new RateLimiter({
  convex: client,
  kind: "user",
  period: "1m",
  rate: 100, // 100 requests per minute
});

async function rateLimitedSearch(userId: string, ...args) {
  // Check rate limit
  const { ok } = await limiter.limit(userId);

  if (!ok) {
    throw new Error("RATE_LIMIT_EXCEEDED");
  }

  // Proceed
  return await cortex.memory.search(...args);
}
```

---

## Best Practices

### 1. Principle of Least Privilege

```typescript
// Don't give agents more access than needed
async function getRelevantContext(
  memorySpaceId: string,
  userId: string,
  query: string,
) {
  // Only get user's data for this agent
  return await cortex.memory.search(agentId, query, {
    userId, // ← Limit to user's data
    minImportance: 50, // ← Skip trivial
    limit: 5, // ← Only what's needed
  });
}
```

### 2. Validate All Inputs

```typescript
// Validate before calling Cortex
function validateMemoryInput(data: MemoryInput) {
  if (!data.content || typeof data.content !== "string") {
    throw new Error("Invalid content");
  }

  if (data.metadata.importance < 0 || data.metadata.importance > 100) {
    throw new Error("Invalid importance");
  }

  if (data.embedding && data.embedding.length !== 3072) {
    throw new Error("Invalid embedding dimension");
  }

  return true;
}

// Use before storing
validateMemoryInput(data);
await cortex.memory.store("agent-1", data);
```

### 3. Log Security Events

```typescript
// Log sensitive operations
async function deleteUserData(userId: string, requestedBy: string) {
  // Audit log
  await auditLog.record({
    action: "USER_DATA_DELETION",
    userId,
    requestedBy,
    timestamp: new Date(),
    reason: "GDPR request",
  });

  // Execute
  const result = await cortex.users.delete(userId, { cascade: true });

  // Log result
  await auditLog.record({
    action: "USER_DATA_DELETION_COMPLETE",
    userId,
    recordsDeleted: result.totalRecordsDeleted,
    timestamp: new Date(),
  });

  return result;
}
```

### 4. Implement Access Control

```typescript
// Check permissions before operations
async function storeMemoryWithACL(
  userId: string,
  memorySpaceId: string,
  data: MemoryInput,
) {
  // Check: Does user own this agent?
  const agent = await cortex.agents.get(agentId);

  if (agent && agent.metadata.ownerId !== userId) {
    throw new Error("PERMISSION_DENIED: User does not own agent");
  }

  // Check: Is user allowed to store this type of data?
  if (data.metadata.sensitivity === "high") {
    const hasPermission = await checkPermission(userId, "STORE_SENSITIVE");

    if (!hasPermission) {
      throw new Error("PERMISSION_DENIED: Cannot store sensitive data");
    }
  }

  // Proceed
  return await cortex.memory.store(agentId, data);
}
```

### 5. Regular Security Audits

```typescript
// Find potential security issues
async function securityAudit() {
  const issues = [];

  // Check for memories without userId (should have for user data)
  const noUserId = await cortex.memory.count("agent-1", {
    "source.type": "conversation",
    userId: null, // Missing userId
  });

  if (noUserId > 0) {
    issues.push(`${noUserId} conversation memories missing userId`);
  }

  // Check for high-importance data without encryption
  const unencrypted = await cortex.memory.count("agent-1", {
    importance: { $gte: 90 },
    "metadata.encrypted": { $ne: true },
  });

  if (unencrypted > 0) {
    issues.push(`${unencrypted} critical memories not encrypted`);
  }

  return issues;
}
```

---

## Security Checklist

### Development

- ✅ Use HTTPS for all Convex connections
- ✅ Store Convex URL in environment variables
- ✅ Don't commit secrets to version control
- ✅ Validate all inputs server-side
- ✅ Use TypeScript for type safety
- ✅ Test GDPR deletion flows

### Production

- ✅ Enable Convex authentication
- ✅ Implement application-level auth
- ✅ Use agent registry for tracking
- ✅ Set up audit logging
- ✅ Configure retention policies
- ✅ Monitor for security events
- ✅ Regular security audits
- ✅ Encrypt sensitive data
- ✅ Rate limiting on APIs
- ✅ WAF/DDoS protection

### Compliance (GDPR/HIPAA)

- ✅ Implement data export
- ✅ Implement cascade deletion (or use Cloud Mode)
- ✅ Document data retention policies
- ✅ Set up audit logging
- ✅ User consent tracking
- ✅ Data Processing Agreement with Convex
- ✅ Privacy policy documentation
- ✅ Security incident response plan

---

## Next Steps

- **[System Overview](./01-system-overview.md)** - Architecture overview
- **[Data Models](./02-data-models.md)** - Schema and data structures
- **[GDPR Compliance Guide](../02-core-features/03-user-profiles.md#pattern-4-gdpr-compliance)** - Implementation guide

---

**Questions?** Ask in [GitHub Discussions](https://github.com/SaintNick1214/cortex/discussions) or [Discord](https://discord.gg/cortex).
