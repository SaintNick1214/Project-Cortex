# Auth Integration (2 Minutes)

> **Last Updated**: 2026-01-01

Quick guide: Integrate Cortex with your existing authentication system.

---

## The Simple Truth

**Cortex works with whatever auth system you already use.** No special integration, no proprietary protocol, no heavy lifting.

**Your auth system** → Extract `userId` → **Pass to Cortex** → Done! ✅

---

## 3-Line Integration

```typescript
import { Cortex, createAuthContext } from "@cortexmemory/sdk";

// 1. Extract from YOUR existing auth (any system)
const auth = createAuthContext({
  userId: yourUser.id,           // Required
  tenantId: yourUser.tenantId,   // Optional (for SaaS)
});

// 2. Pass to Cortex
const cortex = new Cortex({
  convexUrl: process.env.CONVEX_URL!,
  auth,
});

// 3. Use normally - userId auto-injected!
await cortex.memory.remember({
  memorySpaceId: "user-space",
  userMessage: "Hello",
  agentResponse: "Hi!",
  userName: yourUser.name,
  // userId automatically set from auth ✓
});
```

**That's it!** No SDKs to install, no webhooks to configure, no middleware to debug.

---

## Works With Literally Everything

### Auth0, Clerk, Okta, WorkOS

```typescript
// Extract from your provider's SDK
const auth = createAuthContext({
  userId: user.id,    // or user.sub
  tenantId: org.id,   // if multi-tenant
});
```

### NextAuth, Supabase, Firebase

```typescript
// Extract from session/user object
const auth = createAuthContext({
  userId: session.user.id,
});
```

### Custom JWT, OIDC, OAuth

```typescript
// Decode and extract
const decoded = jwt.verify(token, secret);
const auth = createAuthContext({
  userId: decoded.sub,
  tenantId: decoded.tenant_id,
});
```

### Sessions, Cookies, API Keys

```typescript
// Extract from whatever you use
const auth = createAuthContext({
  userId: req.session.userId,
});
```

**The pattern is always the same** - just map your auth data to Cortex's simple structure.

---

## Why So Simple?

**Cortex auth is just data, not a protocol:**

```typescript
// This is all it is:
interface AuthContext {
  userId: string;        // Required
  tenantId?: string;     // Optional
  sessionId?: string;    // Optional
  // ... other optional fields
}
```

**No magic, no lock-in, no complexity.**

You already have auth. Cortex just needs to know:
- Who is the user? (`userId`)
- What tenant? (`tenantId` - if multi-tenant)

---

## For Multi-Tenant SaaS

If you're building SaaS, add `tenantId` for complete isolation:

```typescript
const auth = createAuthContext({
  userId: req.user.id,
  tenantId: req.tenant.id,  // Critical for SaaS!
});

// Now all operations are tenant-scoped
// Tenant A cannot see Tenant B's data - guaranteed
```

See [Isolation Boundaries](../02-core-features/17-isolation-boundaries.md) for complete multi-tenancy guide.

---

## What Happens Behind the Scenes

When you set auth context:

**1. Auto-Injection** - `userId` and `tenantId` added to all operations:

```typescript
// You write:
await cortex.memory.remember({ memorySpaceId: "space-1", ... });

// SDK automatically does:
await cortex.memory.remember({
  memorySpaceId: "space-1",
  userId: "user-123",      // ← From auth
  tenantId: "tenant-abc",  // ← From auth
  ...
});
```

**2. Auto-Filtering** - All queries filtered by `tenantId`:

```typescript
// You write:
const memories = await cortex.memory.search("space-1", "query");

// SDK automatically filters:
// WHERE memorySpaceId = "space-1" AND tenantId = "tenant-abc"
```

**3. Enables Features:**
- ✅ GDPR cascade deletion by userId
- ✅ Multi-tenant data isolation
- ✅ Session tracking
- ✅ Audit trails

---

## Quick Examples by Framework

### Next.js

```typescript
// app/api/chat/route.ts
export async function POST(req: Request) {
  // Get from your auth
  const { userId, orgId } = await getYourAuth(req);

  const cortex = new Cortex({
    convexUrl: process.env.CONVEX_URL!,
    auth: createAuthContext({ userId, tenantId: orgId }),
  });

  // Use cortex...
}
```

### Express

```typescript
// Middleware
app.use((req, res, next) => {
  req.cortex = new Cortex({
    convexUrl: process.env.CONVEX_URL!,
    auth: createAuthContext({
      userId: req.user.id,
      tenantId: req.tenant.id,
    }),
  });
  next();
});

// Use in routes
app.post("/chat", (req, res) => {
  await req.cortex.memory.remember({...});
});
```

### Any Framework

```typescript
// Extract auth data (your code)
const userId = extractUserId(req);
const tenantId = extractTenantId(req);

// Create auth context
const auth = createAuthContext({ userId, tenantId });

// Use with Cortex
const cortex = new Cortex({ convexUrl, auth });
```

---

## Without Auth (For Testing)

Cortex works without auth context:

```typescript
// No auth - for prototypes/testing
const cortex = new Cortex({
  convexUrl: process.env.CONVEX_URL!,
  // No auth
});

// Works, but you must set userId manually
await cortex.memory.remember({
  memorySpaceId: "test-space",
  userId: "test-user",  // Manual
  userMessage: "Hello",
  agentResponse: "Hi!",
  userName: "Test User",
});
```

**Acceptable for:**
- ✅ Quick prototypes
- ✅ Development/testing
- ✅ Single-user apps
- ✅ CLI tools

**Not recommended for:**
- ❌ Production APIs
- ❌ Multi-tenant SaaS
- ❌ User-facing applications

---

## Common Questions

### Q: Do I need to install provider-specific packages?

**A:** No! Cortex doesn't require any auth provider SDKs. Use whatever you already have.

### Q: What if I change auth providers?

**A:** Just update your extraction code. Cortex doesn't care where `userId` comes from.

### Q: Do I need webhooks or callbacks?

**A:** No! Auth context is request-scoped. No async integrations needed.

### Q: What about RBAC/permissions?

**A:** Store in `metadata` field. Cortex provides data isolation, you handle authorization logic.

### Q: Can I test without real auth?

**A:** Yes! Use test values: `createAuthContext({ userId: "test-user" })`

---

## Next Steps

**Start here:**
- [Five-Minute Quickstart](./03-five-minute-quickstart.md) - Get running fast

**Learn more:**
- [Authentication Guide](../02-core-features/18-authentication.md) - Complete concepts
- [Auth Context API](../03-api-reference/15-auth-context-api.md) - API specification

**For multi-tenant SaaS:**
- [Isolation Boundaries](../02-core-features/17-isolation-boundaries.md) - Multi-tenancy guide

---

**Bottom Line:** Auth integration is **3 lines of code** that work with **any auth system**. No complex setup, no provider-specific code, no lock-in.
