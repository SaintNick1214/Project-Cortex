# Authentication

> **Last Updated**: 2026-01-01

Understanding authentication context in Cortex for user tracking, multi-tenancy, and session management.

## Overview

Authentication in Cortex is handled through an **Auth Context** - a flexible data structure that flows through all operations, enabling user tracking, tenant isolation, and session management.

**Key Concept:** Auth context is **just data** - not a protocol or SDK. You extract it from your auth system (whatever that is) and pass it to Cortex.

```typescript
Your Auth System → Extract userId/tenantId → AuthContext → Cortex SDK
   (Auth0, JWT,        (your code)           (data object)  (auto-injects)
    Clerk, custom)
```

---

## Why Authentication Matters

### 1. User Tracking

Link all data to users for personalization and context:

```typescript
const auth = createAuthContext({ userId: "user-123" });
const cortex = new Cortex({ convexUrl, auth });

// All operations automatically include userId
await cortex.memory.remember({
  memorySpaceId: "user-123-personal",
  userMessage: "I prefer dark mode",
  agentResponse: "Noted!",
  userName: "Alice",
  // userId: "user-123" ← Auto-injected
});

// Later: Personalize based on user
const user = await cortex.users.get("user-123");
console.log(user.data.preferences); // Access user's preferences
```

### 2. Multi-Tenancy (SaaS Isolation)

Complete data separation for SaaS platforms:

```typescript
const auth = createAuthContext({
  userId: "user-123",
  tenantId: "customer-acme", // Tenant isolation
});

const cortex = new Cortex({ convexUrl, auth });

// ALL operations scoped to customer-acme
await cortex.memory.remember({...}); // tenantId: "customer-acme"
const spaces = await cortex.memorySpaces.list(); // Only customer-acme's spaces
const users = await cortex.users.list(); // Only customer-acme's users

// Tenant B cannot see Tenant A's data - guaranteed
```

### 3. GDPR Compliance

Enable cascade deletion across all layers:

```typescript
const auth = createAuthContext({
  userId: "user-to-delete",
  tenantId: "customer-acme",
});

const cortex = new Cortex({ convexUrl, auth });

// Delete all user data
await cortex.users.delete("user-to-delete", { cascade: true });

// Deletes:
// ✅ All conversations with userId
// ✅ All memories with userId
// ✅ All facts with userId
// ✅ All sessions with userId
// ✅ User profile
// ❌ Only within tenantId="customer-acme" (other tenants unaffected)
```

### 4. Session Management

Track user activity across devices:

```typescript
const auth = createAuthContext({
  userId: "user-123",
  sessionId: "session-xyz", // Current session
});

const cortex = new Cortex({ convexUrl, auth });

// Session operations track this session
const session = await cortex.sessions.getOrCreate("user-123", {
  deviceType: "web",
});

// Touch session on activity
await cortex.sessions.touch("session-xyz");
```

---

## Quick Start

### Step 1: Extract Auth Information

From your auth system (JWT, session, OAuth token):

```typescript
// Example: JWT token
import jwt from "jsonwebtoken";

function extractAuth(token: string) {
  const decoded = jwt.verify(token, process.env.JWT_SECRET!) as {
    sub: string; // User ID
    tenant_id?: string; // Tenant (if multi-tenant)
    session_id?: string; // Session
    [key: string]: unknown;
  };

  return {
    userId: decoded.sub,
    tenantId: decoded.tenant_id,
    sessionId: decoded.session_id,
    claims: decoded,
  };
}
```

### Step 2: Create Auth Context

```typescript
import { createAuthContext } from "@cortexmemory/sdk";

const auth = createAuthContext({
  userId: extracted.userId,
  tenantId: extracted.tenantId,
  sessionId: extracted.sessionId,
});
```

### Step 3: Initialize Cortex

```typescript
import { Cortex } from "@cortexmemory/sdk";

const cortex = new Cortex({
  convexUrl: process.env.CONVEX_URL!,
  auth, // Pass auth context
});
```

### Step 4: Use Cortex

```typescript
// All operations automatically include auth context
await cortex.memory.remember({
  memorySpaceId: "user-space",
  userMessage: "Hello",
  agentResponse: "Hi!",
  userName: "User",
  // userId, tenantId auto-injected
});
```

---

## Auth Context Fields

### Required: userId

The **only required field** - identifies the authenticated user:

```typescript
const auth = createAuthContext({
  userId: "user-123", // REQUIRED
});
```

**Auto-injected to:**
- Conversations (for GDPR cascade)
- Vector memories (for GDPR cascade)
- Facts (for GDPR cascade)
- Sessions (for user session tracking)
- Immutable records (when user-specific)
- Mutable records (when user-specific)

### Optional: tenantId

**Critical for multi-tenant SaaS** - isolates data by tenant:

```typescript
const auth = createAuthContext({
  userId: "user-123",
  tenantId: "customer-acme", // Multi-tenant isolation
});
```

**Auto-injected to:**
- **EVERY entity in EVERY layer** (complete isolation)
- Conversations, memories, facts, sessions, spaces, users, contexts
- Graph nodes (if graph adapter configured)

**Auto-filtered on:**
- **ALL query operations** (automatic tenant scoping)

### Optional: sessionId

Track user sessions across devices:

```typescript
const auth = createAuthContext({
  userId: "user-123",
  sessionId: "session-xyz",
});
```

**Used for:**
- Session activity tracking
- Multi-device management
- Idle timeout detection
- Session analytics

### Optional: Metadata & Claims

Store additional context:

```typescript
const auth = createAuthContext({
  userId: "user-123",
  claims: {
    email: "user@example.com",
    iss: "https://auth.myapp.com",
  },
  metadata: {
    role: "admin",
    plan: "enterprise",
    department: "engineering",
  },
});
```

**Used for:**
- Application logic (role-based access)
- Audit logging
- Debugging authentication issues
- Custom business logic

---

## Multi-Tenancy Deep Dive

### What is Multi-Tenancy?

**Multi-tenancy** means serving multiple customers (tenants) from the same application instance, with complete data isolation between them.

**Cortex provides complete tenant isolation:**

```
Tenant A                           Tenant B
├─ Users                           ├─ Users
├─ Memory Spaces                   ├─ Memory Spaces
├─ Conversations                   ├─ Conversations
├─ Memories                        ├─ Memories
├─ Facts                           ├─ Facts
├─ Sessions                        ├─ Sessions
└─ Graph Nodes                     └─ Graph Nodes

NO DATA CROSSING ✅
```

### How It Works

**1. Auth context includes tenantId:**

```typescript
const auth = createAuthContext({
  userId: "user-123",
  tenantId: "customer-acme", // Tenant identifier
});
```

**2. SDK auto-injects tenantId to all entities:**

```typescript
// When you call this:
await cortex.memory.remember({ memorySpaceId: "space-1", ... });

// SDK internally does this:
await convex.mutation(api.memories.remember, {
  memorySpaceId: "space-1",
  tenantId: "customer-acme", // ← Auto-injected
  ...params
});
```

**3. All queries automatically filter by tenantId:**

```typescript
// When you call this:
const memories = await cortex.memory.search("space-1", "query");

// SDK internally does this:
await convex.query(api.memories.search, {
  memorySpaceId: "space-1",
  query: "query",
  tenantId: "customer-acme", // ← Auto-filtered
});
```

**Result:** Complete tenant isolation with zero boilerplate.

### Multi-Tenant Example

```typescript
// API endpoint with per-tenant auth
app.post("/api/memory", authenticateUser, async (req, res) => {
  // Extract from your auth system
  const auth = createAuthContext({
    userId: req.user.id,
    tenantId: req.user.tenantId, // From your auth
    sessionId: req.session.id,
  });

  // Per-request Cortex instance
  const cortex = new Cortex({ convexUrl, auth });

  // All operations tenant-scoped
  await cortex.memory.remember({
    memorySpaceId: `user-${req.user.id}-personal`,
    userMessage: req.body.message,
    agentResponse: await generateResponse(req.body.message),
    userName: req.user.name,
  });

  res.json({ success: true });
});
```

**Guarantees:**
- ✅ Tenant A cannot query Tenant B's data
- ✅ Tenant A cannot access Tenant B's memory spaces
- ✅ Tenant A cannot see Tenant B's users
- ✅ GDPR deletion respects tenant boundaries
- ✅ Analytics computed per-tenant only

---

## Common Patterns

### Pattern 1: Web App with JWT

```typescript
// Middleware extracts auth
app.use((req, res, next) => {
  const token = req.headers.authorization?.replace("Bearer ", "");
  if (!token) return res.status(401).send("Unauthorized");

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!);
    req.auth = createAuthContext({
      userId: decoded.sub,
      tenantId: decoded.tenant_id,
      sessionId: decoded.session_id,
    });
    next();
  } catch (err) {
    res.status(401).send("Invalid token");
  }
});

// Route uses auth
app.post("/chat", (req, res) => {
  const cortex = new Cortex({ convexUrl, auth: req.auth });
  // Use cortex...
});
```

### Pattern 2: CLI Tool (No Tenants)

```typescript
// Single-user CLI tool
const auth = createAuthContext({
  userId: "local-user",
  // No tenantId (single user)
  metadata: { hostname: os.hostname() },
});

const cortex = new Cortex({ convexUrl, auth });

// Use throughout CLI
await cortex.memory.remember({...});
```

### Pattern 3: Multi-Org User

User belongs to multiple organizations:

```typescript
// User context with org selection
const auth = createAuthContext({
  userId: "user-123",
  tenantId: "enterprise-corp", // Main tenant
  organizationId: currentOrg.id, // Current org selection
  metadata: {
    availableOrgs: ["team-a", "team-b", "team-c"],
    currentOrg: currentOrg.id,
  },
});

// Switch organizations
function switchOrg(newOrgId: string) {
  return createAuthContext({
    userId: "user-123",
    tenantId: "enterprise-corp",
    organizationId: newOrgId, // Changed org
  });
}
```

### Pattern 4: Background Jobs

Service account for automated tasks:

```typescript
const serviceAuth = createAuthContext({
  userId: "service-session-cleanup",
  metadata: {
    type: "service_account",
    purpose: "cleanup",
    scheduledBy: "cron",
  },
});

const cortex = new Cortex({ convexUrl, auth: serviceAuth });

// Run maintenance
await cortex.sessions.expireIdle();
await cortex.governance.enforce({ scope: { organizationId: "org-123" } });
```

---

## Security Best Practices

### 1. Extract tenantId from Secure Token

```typescript
// ✅ GOOD: From signed JWT
const decoded = jwt.verify(token, secret);
const auth = createAuthContext({
  userId: decoded.sub,
  tenantId: decoded.tenant_id, // From secure source
});

// ❌ BAD: From client input
const auth = createAuthContext({
  userId: decoded.sub,
  tenantId: req.body.tenantId, // User could change this!
});
```

### 2. Validate Auth Context

```typescript
// Validate userId exists in your system
async function validateAuth(auth: AuthContext) {
  const user = await cortex.users.get(auth.userId);
  if (!user) {
    throw new Error("User not found");
  }

  // Validate tenant membership
  if (auth.tenantId && !user.data.tenants?.includes(auth.tenantId)) {
    throw new Error("User not member of tenant");
  }

  return true;
}
```

### 3. Audit Auth Usage

```typescript
// Log all operations with auth context
await auditLog.record({
  action: "cortex_operation",
  userId: auth.userId,
  tenantId: auth.tenantId,
  operation: "memory.remember",
  timestamp: Date.now(),
  ipAddress: req.ip,
});
```

### 4. Rotate Sessions

```typescript
// Expire old sessions periodically
await cortex.sessions.expireIdle({
  idleTimeout: 30 * 60 * 1000, // 30 minutes
});

// End all sessions on critical changes
await cortex.sessions.endAll(userId);
```

---

## Troubleshooting

### Issue: "Missing userId"

**Symptom:** Operations fail with missing userId errors

**Cause:** Auth context not created or userId not set

**Solution:**

```typescript
// Ensure auth context has userId
const auth = createAuthContext({
  userId: req.user.id, // Required
});
```

### Issue: Cross-Tenant Data Visible

**Symptom:** Users see data from other tenants

**Cause:** tenantId not set in auth context

**Solution:**

```typescript
// Always set tenantId for multi-tenant apps
const auth = createAuthContext({
  userId: req.user.id,
  tenantId: req.user.tenantId, // Required for isolation
});
```

### Issue: Session Not Found

**Symptom:** Session operations fail

**Cause:** sessionId in auth context doesn't match existing session

**Solution:**

```typescript
// Create session first or use getOrCreate
const session = await cortex.sessions.getOrCreate(userId, metadata);

const auth = createAuthContext({
  userId,
  sessionId: session.sessionId, // Use actual session ID
});
```

---

## Examples by Use Case

### Personal AI Assistant (Single User)

```typescript
// No tenants, one user
const auth = createAuthContext({
  userId: "alice",
  metadata: { appType: "personal_assistant" },
});

const cortex = new Cortex({ convexUrl, auth });

// All AI tools share user's memory space
await cortex.memory.remember({
  memorySpaceId: "alice-personal",
  participantId: "cursor", // Track which tool
  userMessage: "I prefer TypeScript",
  agentResponse: "Noted!",
  userName: "Alice",
});
```

### SaaS Platform (Multi-Tenant)

```typescript
// Per-customer isolation
app.post("/api/chat", async (req, res) => {
  const auth = createAuthContext({
    userId: req.user.id,
    tenantId: req.tenant.id, // Customer isolation
    sessionId: req.session.id,
  });

  const cortex = new Cortex({ convexUrl, auth });

  // Operations scoped to customer
  await cortex.memory.remember({
    memorySpaceId: `customer-${req.tenant.id}-shared`,
    userMessage: req.body.message,
    agentResponse: await aiResponse(req.body.message),
    userName: req.user.name,
  });

  res.json({ success: true });
});
```

### Enterprise (Hierarchical Tenants)

```typescript
// Tenant → Organizations → Teams
const auth = createAuthContext({
  userId: "user-123",
  tenantId: "enterprise-corp", // Top-level
  organizationId: "engineering-dept", // Mid-level
  metadata: {
    team: "platform-team", // Bottom-level
    role: "senior-engineer",
  },
});

const cortex = new Cortex({ convexUrl, auth });

// Data scoped to enterprise-corp tenant
// organizationId and team available in metadata for app logic
```

---

## Integration Workflow

### Generic Integration Pattern

**Step 1: Your Auth System (Any Provider)**

```typescript
// Your authentication happens here
// Could be: Auth0, Clerk, NextAuth, Supabase, custom JWT, etc.
const userToken = await yourAuthSystem.authenticate(credentials);
```

**Step 2: Extract Auth Data**

```typescript
// Extract relevant fields (your code)
function extractAuthData(token: YourTokenType) {
  return {
    userId: token.sub || token.userId || token.id,
    tenantId: token.tenant_id || token.organizationId,
    sessionId: token.session_id || token.sid,
    // ... extract whatever you need
  };
}
```

**Step 3: Create Auth Context**

```typescript
import { createAuthContext } from "@cortexmemory/sdk";

const extracted = extractAuthData(userToken);
const auth = createAuthContext(extracted);
```

**Step 4: Use with Cortex**

```typescript
const cortex = new Cortex({ convexUrl, auth });

// All operations now authenticated and tenant-scoped
await cortex.memory.remember({...});
```

---

## What Auth Context Does

### Automatic Behaviors

When you set auth context, the SDK automatically:

**1. Injects Fields**
- `userId` → All entities with userId support
- `tenantId` → ALL entities in ALL layers (complete isolation)
- `sessionId` → Session operations

**2. Filters Queries**
- ALL query operations filtered by `tenantId` (if set)
- No cross-tenant data leakage possible

**3. Validates Operations**
- Ensures user exists for user operations
- Validates tenant membership (if configured)
- Checks session validity

**4. Enables Features**
- GDPR cascade deletion by userId
- Multi-device session management
- Tenant-scoped analytics
- Audit trail generation

---

## Without Auth Context

Cortex works without auth context, but you lose:

```typescript
// No auth context
const cortex = new Cortex({ convexUrl });

// Works, but:
// ❌ No automatic userId injection (must set manually)
// ❌ No tenant isolation (single-tenant only)
// ❌ No session tracking
// ❌ GDPR cascade requires manual cleanup

await cortex.memory.remember({
  memorySpaceId: "space-1",
  userId: "user-123", // Must set manually
  userMessage: "Hello",
  agentResponse: "Hi!",
  userName: "User",
});
```

**When this is acceptable:**
- Simple prototypes
- Single-user applications
- Non-production environments
- No multi-tenancy requirements

---

## Advanced Topics

### Claims vs Metadata

**claims** - Raw data from auth provider:

```typescript
claims: {
  sub: "user-123",              // Standard JWT
  iss: "https://auth.myapp.com", // Standard JWT
  aud: "my-api",                 // Standard JWT
  email: "user@example.com",     // Provider-specific
  email_verified: true,          // Provider-specific
}
```

**metadata** - Your application data:

```typescript
metadata: {
  role: "admin",                 // Your RBAC
  plan: "enterprise",            // Your billing
  features: ["ai", "export"],    // Your feature flags
  department: "engineering",     // Your organization
}
```

**Use claims for:** Authentication/provider data  
**Use metadata for:** Application logic and context

### organizationId vs tenantId

**tenantId** - Top-level isolation (SaaS customer):
- Complete data separation
- Auto-filtered on all queries
- Required for proper multi-tenancy

**organizationId** - Sub-grouping within tenant:
- Optional hierarchy
- Not auto-filtered (application-level)
- Use for team/department structure

```typescript
const auth = createAuthContext({
  userId: "user-123",
  tenantId: "enterprise-corp",        // Complete isolation
  organizationId: "engineering-team", // Sub-group (your logic)
});

// tenantId → Automatic database filtering
// organizationId → Your application logic
```

---

## Testing

### Mock Auth Context

```typescript
// test/helpers.ts
export function createTestAuth(overrides?: Partial<AuthContextParams>) {
  return createAuthContext({
    userId: "test-user",
    tenantId: "test-tenant",
    sessionId: "test-session",
    ...overrides,
  });
}

// Usage in tests
it("should store memory", async () => {
  const auth = createTestAuth({ userId: "alice" });
  const cortex = new Cortex({ convexUrl: testUrl, auth });

  await cortex.memory.remember({...});
  // Assertions...
});
```

### Multi-Tenant Testing

```typescript
it("should isolate tenants", async () => {
  // Tenant A
  const authA = createTestAuth({ tenantId: "tenant-a" });
  const cortexA = new Cortex({ convexUrl, auth: authA });

  // Tenant B
  const authB = createTestAuth({ tenantId: "tenant-b" });
  const cortexB = new Cortex({ convexUrl, auth: authB });

  // Store in Tenant A
  await cortexA.memory.remember({
    memorySpaceId: "shared-name",
    userMessage: "Secret A",
    agentResponse: "OK",
    userName: "User A",
  });

  // Query from Tenant B
  const results = await cortexB.memory.search("shared-name", "secret");

  // Should be empty (tenant isolation)
  expect(results).toHaveLength(0);
});
```

---

## Next Steps

- **[Auth Context API](../03-api-reference/15-auth-context-api.md)** - Complete API reference
- **[Isolation Boundaries](./17-isolation-boundaries.md)** - Multi-layer isolation model
- **[Sessions Management](./14-sessions-management.md)** - Session lifecycle
- **[User Profiles](./03-user-profiles.md)** - User management
- **[Memory Spaces](./01-memory-spaces.md)** - Space isolation

---

**Questions?** Ask in [GitHub Discussions](https://github.com/SaintNick1214/cortex/discussions).
