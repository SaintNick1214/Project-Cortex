# Authentication Integration Guide

> **Last Updated**: 2026-01-01  
> **Status**: 🔧 DIY Integration Guide (No Provider Packages)

⚠️ **IMPORTANT: This is NOT a Drop-In Auth Integration**

**Cortex does NOT include pre-built authentication provider integrations.** There is no `npm install @cortexmemory/auth-clerk` or automatic Auth0 setup. This guide provides **generic patterns** for integrating Cortex with your existing authentication system.

## What This Guide Is

✅ **Generic integration patterns** that work with any auth provider  
✅ **AuthContext API documentation** - framework-agnostic interface  
✅ **Example adapters** showing how to extract auth data (as templates)  
✅ **DIY implementation guidance** for common scenarios

## What This Guide Is NOT

❌ **Not a packaged auth integration** - No npm packages for specific providers  
❌ **Not automatic setup** - You write the adapter code  
❌ **Not provider-specific** - Examples are templates, not official integrations  
❌ **Not plug-and-play** - Requires custom implementation

## What Cortex Provides

Cortex provides the **AuthContext API** - a simple, framework-agnostic interface:

```typescript
interface AuthContext {
  userId: string; // Required
  tenantId?: string; // Optional for multi-tenant
  sessionId?: string; // Optional for session tracking
  // ... fully extensible
}
```

**You write the code** to extract this data from your auth provider.

## What You Need to Provide

- ✅ Your auth system (Auth0, Clerk, NextAuth, custom JWT, etc.)
- ✅ Code to extract userId/tenantId from your auth tokens/sessions
- ✅ User validation and authorization logic
- ✅ Integration with your middleware/routes

---

## Core Concept

Cortex accepts a simple AuthContext object. You extract user info from your auth system:

```typescript
// YOUR auth system (any provider)
const session = await yourAuthSystem.getCurrentUser();

// Create Cortex auth context
const auth = createAuthContext({
  userId: session.user.id,
  tenantId: session.organization.id,
  sessionId: session.id,
});

// Use with Cortex
const cortex = new Cortex({ convexUrl, auth });
await cortex.memory.remember({...});
```

---

## What Cortex Provides

**`createAuthContext()` Function:**

- Validates required fields (userId)
- Returns typed AuthContext object
- See [Auth Context API](../03-api-reference/15-auth-context-api.md)

**Auto-Injection:**

- userId → All operations automatically include it
- tenantId → Automatic multi-tenant isolation
- sessionId → Session tracking integration

**Framework Agnostic:**

- Works with any auth provider
- No vendor lock-in
- Full extensibility

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Your Application                          │
├─────────────────────────────────────────────────────────────────┤
│  Auth Provider (Auth0, Clerk, NextAuth, Firebase, etc.)         │
│                           ↓                                      │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │                    Auth Context                              ││
│  │  ┌──────────────┐ ┌──────────────┐ ┌───────────────────────┐││
│  │  │   userId     │ │  tenantId    │ │  claims / metadata    │││
│  │  │  (required)  │ │  (optional)  │ │   (fully extensible)  │││
│  │  └──────────────┘ └──────────────┘ └───────────────────────┘││
│  └─────────────────────────────────────────────────────────────┘│
│                           ↓                                      │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │                     Cortex SDK                               ││
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌────────┐││
│  │  │ Memory  │ │ Sessions│ │  Users  │ │  Facts  │ │ Graph  │││
│  │  │ API     │ │ API     │ │  API    │ │  API    │ │  API   │││
│  │  └─────────┘ └─────────┘ └─────────┘ └─────────┘ └────────┘││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
```

---

## Auth Context Interface

```typescript
interface AuthContext {
  // ─── Required ───────────────────────────────
  userId: string;

  // ─── Standard optional fields (typed) ───────
  tenantId?: string; // SaaS multi-tenancy
  organizationId?: string; // Organization within tenant
  sessionId?: string; // Current session ID
  authProvider?: string; // e.g., 'auth0', 'clerk', 'firebase'
  authMethod?: "oauth" | "api_key" | "jwt" | "session";
  authenticatedAt?: number; // Timestamp of authentication

  // ─── Fully extensible ───────────────────────
  claims?: Record<string, unknown>; // Raw JWT/provider claims
  metadata?: Record<string, unknown>; // Arbitrary developer data
}
```

### Claims vs Metadata

| Field      | Purpose                                    | Example                                |
| ---------- | ------------------------------------------ | -------------------------------------- |
| `claims`   | Raw claims from auth provider (JWT, token) | `{ sub: 'abc', iss: 'auth0.com' }`     |
| `metadata` | Your application-specific data             | `{ plan: 'enterprise', features: [] }` |

---

## Quick Start

### Basic Setup

```typescript
import { Cortex, createAuthContext } from "@cortex-platform/sdk";

// Create auth context from your auth provider
const auth = createAuthContext({
  userId: "user-123",
  tenantId: "tenant-abc", // Optional for multi-tenant apps
  sessionId: "session-xyz",
  authProvider: "auth0",
});

// Initialize Cortex with auth context
const cortex = new Cortex({
  convexUrl: process.env.CONVEX_URL!,
  auth,
});

// All operations now include auth context
await cortex.memory.remember({
  content: "User prefers dark mode",
  memorySpaceId: "user-123-personal",
  // userId is automatically set from auth context
});
```

---

## Generic Integration Pattern

> **This is a template** - adapt it to your auth system.

### Step 1: Extract Auth Data

Extract user/tenant info from your auth system:

```typescript
// Your auth system (any provider)
const yourAuthData = await yourAuthSystem.getCurrentUser();

// Extract relevant fields
const extracted = {
  userId: yourAuthData.id || yourAuthData.sub || yourAuthData.userId,
  tenantId: yourAuthData.tenantId || yourAuthData.organizationId,
  sessionId: yourAuthData.sessionId || yourAuthData.sid,
  // ... map your auth data to Cortex fields
};
```

### Step 2: Create Auth Context

```typescript
import { createAuthContext } from "@cortexmemory/sdk";

const auth = createAuthContext({
  userId: extracted.userId,
  tenantId: extracted.tenantId, // For multi-tenant apps
  sessionId: extracted.sessionId, // For session tracking
  authProvider: "your-provider-name", // e.g., "auth0", "custom"
  authMethod: "jwt", // or "oauth", "session", etc.
  authenticatedAt: Date.now(),
  claims: {
    // Store non-sensitive claims for audit
    email: extracted.email,
    // ... other safe claims
  },
  metadata: {
    // Application-specific data
    role: extracted.role,
    // ... your custom fields
  },
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
  // userId, tenantId auto-injected from auth
});
```

---

## Example: JWT-Based Auth

Complete example with JWT tokens:

```typescript
import jwt from "jsonwebtoken";
import { Cortex, createAuthContext } from "@cortexmemory/sdk";

// Middleware to extract and validate auth
function authMiddleware(req, res, next) {
  const token = req.headers.authorization?.replace("Bearer ", "");

  if (!token) {
    return res.status(401).json({ error: "No token" });
  }

  try {
    // Verify and decode JWT
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as {
      sub: string;
      tenant_id?: string;
      session_id?: string;
      email?: string;
      role?: string;
      [key: string]: unknown;
    };

    // Create auth context
    req.authContext = createAuthContext({
      userId: decoded.sub,
      tenantId: decoded.tenant_id,
      sessionId: decoded.session_id,
      authProvider: "custom-jwt",
      authMethod: "jwt",
      authenticatedAt: Date.now(),
      claims: {
        email: decoded.email,
        // Only non-sensitive claims
      },
      metadata: {
        role: decoded.role,
        // Your app data
      },
    });

    next();
  } catch (error) {
    res.status(401).json({ error: "Invalid token" });
  }
}

// Use in routes
app.post("/api/chat", authMiddleware, async (req, res) => {
  const cortex = new Cortex({
    convexUrl: process.env.CONVEX_URL!,
    auth: req.authContext,
  });

  // Use cortex with auth context
  await cortex.memory.remember({
    memorySpaceId: `user-${req.authContext.userId}-personal`,
    userMessage: req.body.message,
    agentResponse: await generateResponse(req.body.message),
    userName: req.authContext.claims?.email || "User",
  });

  res.json({ success: true });
});
```

---

## Example: Session-Based Auth

Using traditional session cookies:

```typescript
import session from "express-session";

// Session configuration
app.use(
  session({
    secret: process.env.SESSION_SECRET!,
    resave: false,
    saveUninitialized: false,
  }),
);

// Auth middleware
function requireAuth(req, res, next) {
  if (!req.session.userId) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  // Create auth context from session
  req.authContext = createAuthContext({
    userId: req.session.userId,
    tenantId: req.session.tenantId,
    sessionId: req.session.id,
    authMethod: "session",
  });

  next();
}

// Use in routes
app.post("/api/chat", requireAuth, async (req, res) => {
  const cortex = new Cortex({
    convexUrl: process.env.CONVEX_URL!,
    auth: req.authContext,
  });

  // Use cortex...
  res.json({ success: true });
});
```

---

## Data Flow

### Request Flow

```
1. User authenticates with your auth provider
   └─→ Receive token/session from provider

2. Extract auth context from token/session
   └─→ createAuthContext({ userId, tenantId, ... })

3. Initialize Cortex with auth context
   └─→ new Cortex({ auth, ... })

4. Auth context flows through all operations
   └─→ cortex.memory.remember() ← userId auto-set
   └─→ cortex.sessions.create() ← tenantId auto-set
   └─→ cortex.users.update()    ← validated against userId
```

### Storage Flow

```
┌────────────────────────────────────────────────────────────────┐
│                        Auth Context                             │
│  { userId: 'u-123', tenantId: 't-abc', sessionId: 's-xyz' }    │
└────────────────────────────────────────────────────────────────┘
                              ↓
    ┌───────────────────────────────────────────────────────┐
    │                    Cortex SDK                          │
    │  Automatically attaches to all operations:             │
    │  - userId → all records for GDPR cascade              │
    │  - tenantId → all records for isolation               │
    │  - sessionId → session activity tracking              │
    └───────────────────────────────────────────────────────┘
                              ↓
    ┌─────────┬─────────┬─────────┬─────────┬─────────────────┐
    │ Memory  │  Facts  │ Convos  │ Sessions │  Graph Nodes   │
    │ +userId │ +userId │ +userId │ +userId  │  +userId       │
    │+tenantId│+tenantId│+tenantId│+tenantId │ +tenantId      │
    └─────────┴─────────┴─────────┴──────────┴────────────────┘
```

---

## Multi-Tenancy

Cortex supports full SaaS multi-tenant isolation via `tenantId`:

```typescript
// Tenant-scoped auth context
const auth = createAuthContext({
  userId: "user-123",
  tenantId: "customer-acme", // All data isolated by tenant
  organizationId: "team-alpha", // Optional: org within tenant
});

const cortex = new Cortex({ convexUrl, auth });

// All operations are tenant-scoped
await cortex.memory.remember({
  content: "Team meeting notes...",
  memorySpaceId: "acme-shared",
  // tenantId: 'customer-acme' is automatically set
});

// Queries respect tenant isolation
const memories = await cortex.vector.search({
  memorySpaceId: "acme-shared",
  query: "meeting notes",
  // Only returns memories from tenant 'customer-acme'
});
```

### Cross-Tenant Queries (Admin)

For admin dashboards or cross-tenant analytics:

```typescript
// Super-admin context (no tenantId restriction)
const adminAuth = createAuthContext({
  userId: "admin-user",
  // No tenantId = can access all tenants
  metadata: {
    role: "super_admin",
  },
});

const adminCortex = new Cortex({ convexUrl, auth: adminAuth });

// Query across all tenants
const allUsers = await adminCortex.users.list({
  // No tenantId filter = all tenants
  limit: 1000,
});
```

---

## Session Integration

Auth context integrates with the native Sessions API:

```typescript
// Create session from auth context
const auth = createAuthContext({
  userId: "user-123",
  tenantId: "tenant-abc",
  sessionId: "session-xyz",
});

const cortex = new Cortex({ convexUrl, auth });

// Session operations use auth context
const session = await cortex.sessions.getOrCreate("user-123", {
  deviceType: "web",
  userAgent: navigator.userAgent,
});

// Memory operations track session
await cortex.memory.remember({
  content: "User said hello",
  memorySpaceId: "user-123-personal",
  // sessionId: 'session-xyz' tracked implicitly
});
```

---

## Extensibility

### Custom Claims

Pass any claims from your auth provider:

```typescript
const auth = createAuthContext({
  userId: "user-123",
  claims: {
    // Standard JWT claims
    iss: "https://myapp.auth0.com",
    aud: "my-api",
    exp: 1735200000,

    // Custom claims
    "https://myapp.com/plan": "enterprise",
    "https://myapp.com/features": ["ai", "export", "api"],
    "https://myapp.com/quota": { api: 10000, storage: 1000000 },
  },
});
```

### Custom Metadata

Store any application-specific data:

```typescript
const auth = createAuthContext({
  userId: "user-123",
  metadata: {
    // User preferences
    theme: "dark",
    language: "en",
    timezone: "America/New_York",

    // Business context
    department: "engineering",
    team: "platform",
    manager: "manager-456",

    // Feature flags
    features: {
      betaUI: true,
      newAlgorithm: false,
    },

    // Literally anything
    customField: { nested: { data: "supported" } },
  },
});
```

---

## Validation

The `createAuthContext` function validates inputs:

```typescript
// Valid - userId is required
createAuthContext({ userId: "user-123" }); // ✓

// Invalid - missing userId
createAuthContext({ tenantId: "tenant-abc" }); // ✗ Throws error

// Valid - with optional fields
createAuthContext({
  userId: "user-123",
  tenantId: "tenant-abc",
  sessionId: "session-xyz",
  authProvider: "auth0",
  authMethod: "oauth",
  authenticatedAt: Date.now(),
  claims: { email: "user@example.com" },
  metadata: { role: "admin" },
}); // ✓
```

---

## Best Practices

### 1. Always Set tenantId for Multi-Tenant Apps

```typescript
// Good: Tenant isolation prevents data leakage
const auth = createAuthContext({
  userId: "user-123",
  tenantId: req.headers["x-tenant-id"], // From request
});

// Bad: No isolation between tenants
const auth = createAuthContext({
  userId: "user-123",
  // Missing tenantId!
});
```

### 2. Track Sessions for Activity Analytics

```typescript
// Good: Session tracking enables analytics
const auth = createAuthContext({
  userId: "user-123",
  sessionId: session.id,
});

// Session activity is automatically tracked
```

### 3. Store Provider Claims for Debugging

```typescript
// Good: Raw claims help debug auth issues
const auth = createAuthContext({
  userId: decoded.sub,
  claims: decoded, // Store full JWT payload
});

// Bad: Losing original claims
const auth = createAuthContext({
  userId: decoded.sub,
  // Claims lost, harder to debug
});
```

### 4. Use Metadata for Application Data

```typescript
// Good: Separate concerns
const auth = createAuthContext({
  userId: "user-123",
  claims: {
    /* Raw provider data */
  },
  metadata: {
    /* Your app data */
  },
});

// Bad: Mixing concerns
const auth = createAuthContext({
  userId: "user-123",
  claims: {
    email: "user@example.com",
    yourAppRole: "admin", // App data in claims
  },
});
```

---

---

## Framework Examples

> **Generic patterns** - adapt to your specific auth provider.

### Next.js API Route

```typescript
// app/api/chat/route.ts
import { Cortex, createAuthContext } from "@cortexmemory/sdk";

export async function POST(req: Request) {
  // Extract auth from YOUR auth system (Auth0, Clerk, custom, etc.)
  const yourAuthData = await getYourAuthData(req);

  if (!yourAuthData.userId) {
    return new Response("Unauthorized", { status: 401 });
  }

  // Create auth context from your data
  const cortex = new Cortex({
    convexUrl: process.env.CONVEX_URL!,
    auth: createAuthContext({
      userId: yourAuthData.userId,
      tenantId: yourAuthData.tenantId, // For multi-tenant
      sessionId: yourAuthData.sessionId,
    }),
  });

  const { message } = await req.json();

  await cortex.memory.remember({
    memorySpaceId: `user-${yourAuthData.userId}-personal`,
    userMessage: message,
    agentResponse: "Processing...",
    userName: yourAuthData.name || "User",
  });

  return new Response("OK");
}
```

### Express.js with Middleware

```typescript
// middleware/auth.ts
import { Request, Response, NextFunction } from "express";
import { createAuthContext } from "@cortexmemory/sdk";

export async function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  // Extract from YOUR auth system
  const authData = await extractYourAuthData(req);

  if (!authData.userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  // Create auth context
  req.authContext = createAuthContext({
    userId: authData.userId,
    tenantId: authData.tenantId,
    sessionId: authData.sessionId,
  });

  next();
}

// routes/chat.ts
app.post("/chat", authMiddleware, async (req, res) => {
  const cortex = new Cortex({
    convexUrl: process.env.CONVEX_URL!,
    auth: req.authContext,
  });

  // Use cortex...
  res.json({ success: true });
});
```

### JWT Token Validation

```typescript
import jwt from "jsonwebtoken";
import { createAuthContext } from "@cortexmemory/sdk";

function extractAuthFromJWT(token: string) {
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as {
      sub: string;
      tenant_id?: string;
      session_id?: string;
      [key: string]: unknown;
    };

    return createAuthContext({
      userId: decoded.sub,
      tenantId: decoded.tenant_id,
      sessionId: decoded.session_id,
      authMethod: "jwt",
      authenticatedAt: Date.now(),
      claims: {
        // Only non-sensitive claims
        email: decoded.email,
      },
    });
  } catch (error) {
    throw new Error("Invalid JWT token");
  }
}

// Usage
const token = req.headers.authorization?.replace("Bearer ", "");
const auth = extractAuthFromJWT(token);
const cortex = new Cortex({ convexUrl, auth });
```

## Example: API Key Auth

Using API keys for service accounts:

```typescript
// API key validation
function validateApiKey(apiKey: string) {
  // Your validation logic
  const key = db.apiKeys.findOne({ key: apiKey });

  if (!key) {
    throw new Error("Invalid API key");
  }

  return createAuthContext({
    userId: key.userId,
    tenantId: key.tenantId,
    authMethod: "api_key",
    authenticatedAt: Date.now(),
    metadata: {
      apiKeyId: key.id,
      permissions: key.permissions,
    },
  });
}

// Use in API
app.post("/api/memory", async (req, res) => {
  const apiKey = req.headers["x-api-key"];

  if (!apiKey) {
    return res.status(401).json({ error: "Missing API key" });
  }

  try {
    const auth = validateApiKey(apiKey);
    const cortex = new Cortex({ convexUrl, auth });

    // Use cortex...
    res.json({ success: true });
  } catch (error) {
    res.status(401).json({ error: "Invalid API key" });
  }
});
```

---

## Security Considerations

### 1. Never Store Sensitive Tokens

```typescript
// ❌ BAD: Storing sensitive tokens
const auth = createAuthContext({
  userId: "user-123",
  claims: {
    access_token: "secret-token", // Never store!
    refresh_token: "secret-refresh", // Never store!
  },
});

// ✅ GOOD: Store only public claims
const auth = createAuthContext({
  userId: decoded.sub,
  claims: {
    email: decoded.email,
    iss: decoded.iss,
    aud: decoded.aud,
    // Only non-sensitive claims
  },
});
```

### 2. Validate tenantId from Token

```typescript
// ✅ GOOD: Extract tenantId from secure token
const decoded = jwt.verify(token, process.env.JWT_SECRET!);
const auth = createAuthContext({
  userId: decoded.sub,
  tenantId: decoded.tenant_id, // From signed token
});

// ❌ BAD: Trust client-provided tenantId
const auth = createAuthContext({
  userId: decoded.sub,
  tenantId: req.body.tenantId, // User could lie!
});
```

### 3. Rotate Sessions Regularly

```typescript
// Expire old sessions periodically
await cortex.sessions.expireIdle({
  idleTimeout: 30 * 60 * 1000, // 30 minutes
});

// End all sessions on password change
await cortex.sessions.endAll(userId);
```

### 4. Audit Auth Context Usage

```typescript
// Log auth context for security audit
await auditLog.record({
  action: "cortex_operation",
  userId: auth.userId,
  tenantId: auth.tenantId,
  operation: "memory.remember",
  timestamp: Date.now(),
});
```

---

## Per-Request vs Singleton Pattern

### Per-Request (Recommended for APIs)

Create new Cortex instance per request for tenant isolation:

```typescript
// API route handler
app.post("/api/chat", async (req, res) => {
  // Extract auth from request
  const authContext = extractAuthContext(req);

  // New Cortex instance per request
  const cortex = new Cortex({
    convexUrl: process.env.CONVEX_URL!,
    auth: authContext, // Request-specific auth
  });

  // Operations use this request's auth
  await cortex.memory.remember({...});

  res.json({ success: true });
});

// ✅ Benefits:
// - Proper tenant isolation
// - No cross-request pollution
// - Clean auth context per request
```

### Singleton (For Single-User Apps)

Reuse Cortex instance for single-user applications:

```typescript
// Single-user app (desktop, CLI)
const auth = createAuthContext({
  userId: "local-user",
  // No tenantId needed
});

// Global Cortex instance
const cortex = new Cortex({ convexUrl, auth });

// Use throughout app
await cortex.memory.remember({...});
await cortex.memory.search(...);

// ✅ Benefits:
// - Simpler code
// - Better performance (connection reuse)
// - Suitable for CLI, desktop apps
```

---

## Troubleshooting

### Issue 1: "User not found"

**Symptom:** Operations fail with user not found errors

**Cause:** userId in auth context doesn't match user profile

**Solution:**

```typescript
// Ensure user profile exists
const auth = createAuthContext({ userId: "user-123" });
const cortex = new Cortex({ convexUrl, auth });

// Create user profile if needed
await cortex.users.getOrCreate("user-123", {
  displayName: "New User",
  preferences: {},
});
```

### Issue 2: Cross-Tenant Data Leakage

**Symptom:** Users see data from other tenants

**Cause:** tenantId not set in auth context

**Solution:**

```typescript
// ✅ Always extract tenantId from secure source
const decoded = jwt.verify(token, secret);
const auth = createAuthContext({
  userId: decoded.sub,
  tenantId: decoded.tenant_id, // From signed token
});
```

### Issue 3: Session Not Tracking Activity

**Symptom:** Sessions expire even when user is active

**Cause:** Not calling `touch()` on user interactions

**Solution:**

```typescript
// Update session activity on each interaction
await cortex.sessions.touch(sessionId);

// Or use getOrCreate which auto-touches
const session = await cortex.sessions.getOrCreate(userId, metadata);
```

---

## GDPR Integration

Auth context enables cascade deletion:

```typescript
// User requests data deletion
const auth = createAuthContext({
  userId: "user-to-delete",
  tenantId: "customer-acme",
});

const cortex = new Cortex({ convexUrl, auth });

// Cascade delete respects auth context
await cortex.users.delete("user-to-delete", {
  cascade: true, // Delete across ALL layers
});

// Deletes:
// ✅ All data with userId="user-to-delete"
// ✅ Only within tenantId="customer-acme" (if set)
// ✅ Conversations, memories, facts, sessions, graph nodes
```

See [User Operations - GDPR Cascade](../03-api-reference/04-user-operations.md#delete) for complete details.

---

## Advanced Patterns

### Pattern 1: Impersonation (Admin)

```typescript
// Admin impersonating user for support
const adminAuth = createAuthContext({
  userId: "customer-user-123", // Impersonated user
  tenantId: "customer-acme",
  metadata: {
    impersonatedBy: "admin-456",
    impersonationReason: "Customer support",
    impersonatedAt: Date.now(),
  },
});

const cortex = new Cortex({ convexUrl, auth: adminAuth });

// Operations run as customer-user-123
// But tracked as admin impersonation in metadata
```

### Pattern 2: Service Account

```typescript
// Background job with service account
const serviceAuth = createAuthContext({
  userId: "service-account-cleanup",
  metadata: {
    type: "service_account",
    purpose: "cleanup_old_sessions",
  },
});

const cortex = new Cortex({ convexUrl, auth: serviceAuth });

// Run cleanup operations
await cortex.sessions.expireIdle();
```

### Pattern 3: Dynamic Tenant Selection

```typescript
// User switches between organizations
async function switchOrganization(userId: string, newOrgId: string) {
  // Create new auth context with different tenant
  const auth = createAuthContext({
    userId,
    tenantId: newOrgId, // Changed tenant
    organizationId: newOrgId,
    metadata: {
      switchedAt: Date.now(),
    },
  });

  // New Cortex instance for new tenant context
  return new Cortex({ convexUrl, auth });
}
```

---

## Testing

### Mock Auth Context

```typescript
// test/helpers.ts
export function createMockAuthContext(overrides?: Partial<AuthContext>) {
  return createAuthContext({
    userId: "test-user-123",
    tenantId: "test-tenant",
    sessionId: "test-session",
    authProvider: "test",
    authenticatedAt: Date.now(),
    ...overrides,
  });
}

// test/memory.test.ts
it("should store memory with auth context", async () => {
  const auth = createMockAuthContext({ userId: "test-user" });
  const cortex = new Cortex({ convexUrl: testUrl, auth });

  await cortex.memory.remember({...});
  // Assertions...
});
```

---

## Migration Guide

### From No Auth → With Auth

```typescript
// Before: No auth context
const cortex = new Cortex({ convexUrl });
await cortex.memory.remember({
  userId: "user-123", // Manual
  // ...
});

// After: With auth context
const auth = createAuthContext({ userId: "user-123" });
const cortex = new Cortex({ convexUrl, auth });
await cortex.memory.remember({
  // userId automatically set from auth
  // ...
});
```

### From Single-Tenant → Multi-Tenant

```typescript
// Before: No tenant isolation
const auth = createAuthContext({
  userId: req.user.id,
  // No tenantId
});

// After: With tenant isolation
const auth = createAuthContext({
  userId: req.user.id,
  tenantId: req.tenant.id, // Added tenant
});

// All operations now tenant-scoped
```

---

---

## Next Steps

### Understanding Auth Context

- **[Auth Context API](../03-api-reference/15-auth-context-api.md)** - Complete API reference
- **[Authentication](../02-core-features/18-authentication.md)** - Core concepts guide

### Related Features

- **[Isolation Boundaries](../02-core-features/17-isolation-boundaries.md)** - Multi-layer isolation model
- **[Sessions Management](../02-core-features/14-sessions-management.md)** - Session lifecycle
- **[User Profiles](../02-core-features/03-user-profiles.md)** - User management + GDPR
- **[Memory Spaces](../02-core-features/01-memory-spaces.md)** - Space isolation

### API Reference

- **[Sessions Operations API](../03-api-reference/14-sessions-operations.md)** - Session API
- **[User Operations API](../03-api-reference/04-user-operations.md)** - User API
- **[Memory Space Operations API](../03-api-reference/11-memory-space-operations.md)** - Space API

---

**Questions?** Ask in [GitHub Discussions](https://github.com/SaintNick1214/cortex/discussions).
