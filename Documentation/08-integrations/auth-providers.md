# Authentication Integration

> **Last Updated**: 2025-12-26

Guide for integrating authentication with Cortex for user-facing agentic platforms.

## Overview

Cortex provides a flexible authentication context system that integrates with any auth provider while maintaining framework agnosticism. The auth context flows through all API operations, enabling consistent user tracking, multi-tenancy, and session management.

**Key Principles:**

- **Framework Agnostic**: Works with Auth0, Clerk, NextAuth, Firebase, custom JWT, or any auth system
- **Batteries Included**: Standard fields for common use cases, fully extensible for custom needs
- **Zero Lock-in**: Auth context is just data - no proprietary protocol or SDK required
- **Implicit Tracking**: Once set, auth context propagates automatically through all operations

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

## Provider Integration Examples

### Auth0

```typescript
import { useAuth0 } from "@auth0/auth0-react";

function useAuthContext(): AuthContext {
  const { user, getAccessTokenSilently } = useAuth0();

  return {
    userId: user.sub,
    authProvider: "auth0",
    authMethod: "oauth",
    authenticatedAt: Date.now(),
    claims: {
      email: user.email,
      name: user.name,
      picture: user.picture,
      email_verified: user.email_verified,
    },
    metadata: {
      // Your custom claims from Auth0 Rules/Actions
      roles: user["https://myapp.com/roles"],
      permissions: user["https://myapp.com/permissions"],
    },
  };
}
```

### Clerk

```typescript
import { useUser, useAuth } from "@clerk/nextjs";

function useAuthContext(): AuthContext {
  const { user } = useUser();
  const { sessionId, orgId } = useAuth();

  return {
    userId: user.id,
    sessionId,
    organizationId: orgId,
    authProvider: "clerk",
    authMethod: "session",
    authenticatedAt: Date.now(),
    claims: {
      email: user.primaryEmailAddress?.emailAddress,
      firstName: user.firstName,
      lastName: user.lastName,
    },
    metadata: {
      publicMetadata: user.publicMetadata,
      // Access private metadata server-side only
    },
  };
}
```

### NextAuth

```typescript
import { getServerSession } from "next-auth/next";
import { authOptions } from "./auth";

async function getAuthContext(): Promise<AuthContext> {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    throw new Error("Not authenticated");
  }

  return {
    userId: session.user.id,
    sessionId: session.sessionToken,
    authProvider: "nextauth",
    authMethod: "oauth",
    authenticatedAt: Date.now(),
    claims: {
      email: session.user.email,
      name: session.user.name,
      image: session.user.image,
    },
    metadata: {
      role: session.user.role,
      // Custom fields from your adapter
    },
  };
}
```

### Firebase Auth

```typescript
import { getAuth, onAuthStateChanged } from "firebase/auth";

function useAuthContext(): AuthContext | null {
  const [auth, setAuth] = useState<AuthContext | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(getAuth(), async (user) => {
      if (user) {
        const token = await user.getIdTokenResult();
        setAuth({
          userId: user.uid,
          authProvider: "firebase",
          authMethod: "oauth",
          authenticatedAt: new Date(token.authTime).getTime(),
          claims: {
            email: user.email,
            displayName: user.displayName,
            photoURL: user.photoURL,
            emailVerified: user.emailVerified,
          },
          metadata: {
            // Custom claims from Firebase
            ...token.claims,
          },
        });
      } else {
        setAuth(null);
      }
    });

    return unsubscribe;
  }, []);

  return auth;
}
```

### Custom JWT

```typescript
import jwt from "jsonwebtoken";

function parseAuthContext(token: string): AuthContext {
  const decoded = jwt.verify(token, process.env.JWT_SECRET!) as {
    sub: string;
    tenant_id?: string;
    org_id?: string;
    session_id?: string;
    iat: number;
    [key: string]: unknown;
  };

  return {
    userId: decoded.sub,
    tenantId: decoded.tenant_id,
    organizationId: decoded.org_id,
    sessionId: decoded.session_id,
    authProvider: "custom",
    authMethod: "jwt",
    authenticatedAt: decoded.iat * 1000,
    claims: decoded,
  };
}
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

## Related APIs

- [Sessions Operations](../03-api-reference/16-sessions-operations.md) - Session lifecycle management
- [User Operations](../03-api-reference/04-user-operations.md) - User profiles and GDPR deletion
- [Governance Policies](../03-api-reference/10-governance-policies-api.md) - Session lifecycle policies
