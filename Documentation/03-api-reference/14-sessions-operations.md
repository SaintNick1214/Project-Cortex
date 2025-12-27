# Sessions Operations API

> **Last Updated**: 2025-12-26

Complete API reference for session lifecycle management and multi-session support.

## Overview

The Sessions API (`cortex.sessions.*`) provides native session management for user-facing agentic platforms. Sessions track user interactions, manage activity timeouts, and provide an isolated context for conversations.

**Key Features:**

- **Multi-Session Support**: Users can have multiple active sessions (web, mobile, API)
- **Activity Tracking**: Automatic idle detection and session expiration
- **Extensible Metadata**: Fully flexible metadata for any developer needs
- **Configurable Timeouts**: Per-tenant or per-session lifecycle policies (via Governance API)
- **GDPR Integration**: Sessions cascade delete with user deletion

---

## Session Lifecycle

```
┌─────────────┐      ┌─────────────┐      ┌─────────────┐
│   ACTIVE    │──────│    IDLE     │──────│   ENDED     │
│             │      │             │      │             │
│ User active │      │ No activity │      │ Terminated  │
│ < 30min     │      │ < 24h       │      │             │
└─────────────┘      └─────────────┘      └─────────────┘
       │                    │                    ▲
       │    touch()         │    expireIdle()    │
       └────────────────────┼────────────────────┘
                            │
                    After 24h idle
```

**Default Timeouts (Configurable via Governance):**

| State  | Timeout | Description                      |
| ------ | ------- | -------------------------------- |
| Active | 30m     | No activity moves to idle        |
| Idle   | 24h     | After 24h idle, session is ended |

---

## Session Type

```typescript
interface Session {
  sessionId: string;
  userId: string;
  tenantId?: string;
  memorySpaceId?: string;

  // Session state
  status: "active" | "idle" | "ended";
  startedAt: number;
  lastActiveAt: number;
  endedAt?: number;
  expiresAt?: number;

  // Fully extensible metadata - any shape you need
  metadata?: Record<string, unknown>;

  // Stats
  messageCount: number;
  memoryCount: number;
}
```

### Metadata Flexibility

The `metadata` field is completely flexible and can store any data your application needs:

```typescript
// Device and client info
await cortex.sessions.create({
  userId: "user-123",
  metadata: {
    deviceType: "mobile",
    appVersion: "2.1.0",
    platform: "ios",
    deviceId: "device-xyz",
  },
});

// Auth provider claims
await cortex.sessions.create({
  userId: "user-123",
  metadata: {
    authProvider: "auth0",
    authMethod: "oauth",
    email: "user@example.com",
    roles: ["admin", "editor"],
    permissions: ["read", "write", "delete"],
    customClaim: "any-value",
  },
});

// Geographic context
await cortex.sessions.create({
  userId: "user-123",
  metadata: {
    ipAddress: "192.168.1.1",
    country: "US",
    timezone: "America/New_York",
    locale: "en-US",
  },
});
```

---

## Core Operations

### create()

Create a new session for a user.

**Signature:**

```typescript
cortex.sessions.create(params: CreateSessionParams): Promise<Session>

interface CreateSessionParams {
  userId: string;
  tenantId?: string;
  memorySpaceId?: string;
  metadata?: Record<string, unknown>;
  expiresAt?: number;  // Optional: override default expiry
}
```

**Example:**

```typescript
// Create a new session
const session = await cortex.sessions.create({
  userId: "user-123",
  tenantId: "tenant-abc",
  memorySpaceId: "user-123-personal",
  metadata: {
    deviceType: "web",
    userAgent: "Mozilla/5.0...",
    authProvider: "google",
  },
});

console.log(`Session ${session.sessionId} started`);
```

---

### get()

Get a session by ID.

**Signature:**

```typescript
cortex.sessions.get(sessionId: string): Promise<Session | null>
```

**Example:**

```typescript
const session = await cortex.sessions.get("session-xyz");
if (session) {
  console.log(`Status: ${session.status}`);
  console.log(`Last active: ${new Date(session.lastActiveAt)}`);
}
```

---

### getOrCreate()

Get existing active session for user, or create a new one.

**Signature:**

```typescript
cortex.sessions.getOrCreate(
  userId: string,
  metadata?: Record<string, unknown>
): Promise<Session>
```

**Example:**

```typescript
// Returns existing active session or creates new one
const session = await cortex.sessions.getOrCreate("user-123", {
  deviceType: "mobile",
});

// Useful for "resume session" flows
console.log(`Using session ${session.sessionId}`);
```

---

### touch()

Update session activity timestamp (heartbeat).

**Signature:**

```typescript
cortex.sessions.touch(sessionId: string): Promise<void>
```

**Example:**

```typescript
// Update activity on every user interaction
await cortex.sessions.touch(session.sessionId);

// Prevents session from going idle
```

---

### end()

Explicitly end a session.

**Signature:**

```typescript
cortex.sessions.end(sessionId: string): Promise<void>
```

**Example:**

```typescript
// End session on logout
await cortex.sessions.end(session.sessionId);

// Session is now 'ended' and cannot be resumed
```

---

### endAll()

End all active sessions for a user.

**Signature:**

```typescript
cortex.sessions.endAll(userId: string): Promise<{ ended: number }>
```

**Example:**

```typescript
// End all sessions on password change
const result = await cortex.sessions.endAll("user-123");
console.log(`Ended ${result.ended} sessions`);
```

---

### list()

List sessions with filters.

**Signature:**

```typescript
cortex.sessions.list(filters: SessionFilters): Promise<Session[]>

interface SessionFilters {
  userId?: string;
  tenantId?: string;
  status?: 'active' | 'idle' | 'ended';
  startedAfter?: number;
  startedBefore?: number;
  limit?: number;
  offset?: number;
}
```

**Example:**

```typescript
// Get all active sessions for a user
const activeSessions = await cortex.sessions.list({
  userId: "user-123",
  status: "active",
});

// Get tenant-wide sessions
const tenantSessions = await cortex.sessions.list({
  tenantId: "tenant-abc",
  status: "active",
  limit: 100,
});
```

---

### count()

Count sessions matching filters.

**Signature:**

```typescript
cortex.sessions.count(filters: SessionFilters): Promise<number>
```

**Example:**

```typescript
const activeSessions = await cortex.sessions.count({
  tenantId: "tenant-abc",
  status: "active",
});

console.log(`${activeSessions} users currently online`);
```

---

### getActive()

Get all active sessions for a user.

**Signature:**

```typescript
cortex.sessions.getActive(userId: string): Promise<Session[]>
```

**Example:**

```typescript
const sessions = await cortex.sessions.getActive("user-123");
console.log(`User has ${sessions.length} active sessions`);

// Useful for "active devices" view
sessions.forEach((s) => {
  console.log(`- ${s.metadata?.deviceType}: ${s.sessionId}`);
});
```

---

### expireIdle()

Expire idle sessions (typically run as background job).

**Signature:**

```typescript
cortex.sessions.expireIdle(options?: ExpireOptions): Promise<{ expired: number }>

interface ExpireOptions {
  tenantId?: string;       // Limit to specific tenant
  maxAge?: number;         // Override default idle timeout (ms)
  dryRun?: boolean;        // Preview without expiring
}
```

**Example:**

```typescript
// Background job to clean up idle sessions
const result = await cortex.sessions.expireIdle({
  tenantId: "tenant-abc",
});

console.log(`Expired ${result.expired} idle sessions`);
```

---

## Session Policies (Governance)

Session lifecycle timeouts are configurable via the Governance API.

```typescript
await cortex.governance.setPolicy({
  organizationId: "org-123",

  // Session lifecycle configuration
  sessions: {
    inactiveTimeout: 1800000, // 30 minutes (ms)
    absoluteTimeout: 86400000, // 24 hours (ms)
    maxSessionsPerUser: 10, // Optional limit
  },
});
```

See [Governance Policies API](./10-governance-policies-api.md) for full configuration options.

---

## Multi-Tenancy

Sessions support full multi-tenant isolation via `tenantId`:

```typescript
// Create tenant-scoped session
const session = await cortex.sessions.create({
  userId: 'user-123',
  tenantId: 'customer-abc',  // SaaS platform isolation
  metadata: { ... },
});

// Query sessions within tenant
const tenantSessions = await cortex.sessions.list({
  tenantId: 'customer-abc',
  status: 'active',
});
```

---

## Integration with Auth Context

Sessions integrate with the Auth Context system for seamless authentication:

```typescript
import { createAuthContext } from "@cortex-platform/sdk";

// Create auth context with session
const auth = createAuthContext({
  userId: "user-123",
  sessionId: "session-xyz",
  tenantId: "tenant-abc",
  authProvider: "auth0",
  claims: {
    email: "user@example.com",
    roles: ["admin"],
  },
});

// Initialize Cortex with auth context
const cortex = new Cortex({
  convexUrl: process.env.CONVEX_URL!,
  auth,
});

// Session ID is automatically tracked
await cortex.memory.remember({
  content: "User prefers dark mode",
  // ... sessionId is implicitly associated
});
```

---

## GDPR Cascade

Sessions are included in GDPR cascade deletion:

```typescript
// When deleting a user, all their sessions are also deleted
await cortex.users.delete("user-123", { cascade: true });

// Sessions are deleted as part of the cascade:
// ✅ User profile
// ✅ All sessions for user  <-- NEW
// ✅ All conversations
// ✅ All memories
// ✅ All facts
// ✅ Graph nodes (if configured)
```

---

## Real-World Patterns

### Session Resume Flow

```typescript
async function handleUserConnection(
  userId: string,
  metadata: Record<string, unknown>,
) {
  // Try to get existing active session
  const existingSessions = await cortex.sessions.getActive(userId);

  if (existingSessions.length > 0) {
    // Resume most recent session
    const session = existingSessions[0];
    await cortex.sessions.touch(session.sessionId);
    return session;
  }

  // Create new session
  return cortex.sessions.create({
    userId,
    metadata,
  });
}
```

### Multi-Device Support

```typescript
async function getActiveSessions(userId: string) {
  const sessions = await cortex.sessions.getActive(userId);

  return sessions.map((s) => ({
    id: s.sessionId,
    device: s.metadata?.deviceType || "unknown",
    lastActive: new Date(s.lastActiveAt),
    isCurrent: s.sessionId === currentSessionId,
  }));
}

async function logoutOtherDevices(userId: string, currentSessionId: string) {
  const sessions = await cortex.sessions.getActive(userId);

  for (const session of sessions) {
    if (session.sessionId !== currentSessionId) {
      await cortex.sessions.end(session.sessionId);
    }
  }
}
```

### Session Analytics

```typescript
async function getSessionStats(tenantId: string) {
  const [active, idle, ended] = await Promise.all([
    cortex.sessions.count({ tenantId, status: "active" }),
    cortex.sessions.count({ tenantId, status: "idle" }),
    cortex.sessions.count({ tenantId, status: "ended" }),
  ]);

  return {
    currentlyOnline: active,
    recentlyActive: idle,
    totalSessions: active + idle + ended,
  };
}
```

---

## Error Handling

```typescript
import { CortexError, CortexErrorCode } from "@cortex-platform/sdk";

try {
  await cortex.sessions.touch("invalid-session-id");
} catch (error) {
  if (error instanceof CortexError) {
    switch (error.code) {
      case CortexErrorCode.SESSION_NOT_FOUND:
        // Session doesn't exist or was already ended
        break;
      case CortexErrorCode.SESSION_EXPIRED:
        // Session has expired
        break;
      case CortexErrorCode.SESSION_ALREADY_ENDED:
        // Session was already ended
        break;
    }
  }
}
```

---

## Related APIs

- [User Operations](./04-user-operations.md) - User profiles and GDPR deletion
- [Auth Integration](../08-integrations/auth-providers.md) - Authentication context
- [Governance Policies](./10-governance-policies-api.md) - Session lifecycle policies
- [Memory Operations](./02-memory-operations.md) - Session-scoped memories
