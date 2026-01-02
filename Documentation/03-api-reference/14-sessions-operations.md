# Sessions Operations API

> **Last Updated**: 2026-01-01

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
  _id: string; // Convex document ID
  sessionId: string; // Unique session identifier
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
  metadata?: SessionMetadata;

  // Stats
  messageCount: number;
  memoryCount: number;
}

interface SessionMetadata {
  device?: string;
  browser?: string;
  browserVersion?: string;
  os?: string;
  deviceType?: "desktop" | "mobile" | "tablet" | string;
  ip?: string;
  location?: string;
  timezone?: string;
  language?: string;
  userAgent?: string;
  [key: string]: unknown; // Any additional custom fields
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
  sessionId?: string;                  // Optional: custom ID (auto-generated if not provided)
  userId: string;                      // Required: user this session belongs to
  tenantId?: string;                   // Multi-tenant isolation
  memorySpaceId?: string;              // Associate with memory space
  metadata?: SessionMetadata;          // Fully extensible metadata
  expiresAt?: number;                  // Optional: override default expiry (ms since epoch)
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
cortex.sessions.endAll(
  userId: string,
  options?: EndAllOptions
): Promise<EndSessionsResult>

interface EndAllOptions {
  /**
   * Tenant ID for multi-tenant isolation.
   * When provided, only ends sessions for the user within that tenant.
   * Without this (and no AuthContext), ALL sessions for the userId across ALL tenants are ended.
   */
  tenantId?: string;
}

interface EndSessionsResult {
  ended: number;           // Number of sessions ended
  sessionIds: string[];    // IDs of sessions that were ended
}
```

**Example:**

```typescript
// End all sessions on password change
const result = await cortex.sessions.endAll("user-123");
console.log(`Ended ${result.ended} sessions`);
console.log(`Session IDs: ${result.sessionIds.join(", ")}`);

// End sessions only for a specific tenant (multi-tenant safe)
const tenantResult = await cortex.sessions.endAll("user-123", {
  tenantId: "tenant-abc",
});
console.log(`Ended ${tenantResult.ended} sessions in tenant`);
```

---

### list()

List sessions with filters.

**Signature:**

```typescript
cortex.sessions.list(filters: SessionFilters): Promise<Session[]>

interface SessionFilters {
  userId?: string;                         // Filter by user ID
  tenantId?: string;                       // Filter by tenant ID
  memorySpaceId?: string;                  // Filter by memory space
  status?: 'active' | 'idle' | 'ended';    // Filter by status
  limit?: number;                          // Max results (1-1000, default: 50)
  offset?: number;                         // Pagination offset

  // 🔮 PLANNED: Date range filters (not yet implemented)
  // startedAfter?: number;
  // startedBefore?: number;
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

// Get sessions by memory space
const spaceSessions = await cortex.sessions.list({
  memorySpaceId: "project-workspace",
  status: "active",
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
cortex.sessions.expireIdle(options?: ExpireSessionsOptions): Promise<{ expired: number }>

interface ExpireSessionsOptions {
  tenantId?: string;       // Limit to specific tenant
  idleTimeout?: number;    // Idle timeout in milliseconds (default: 30 minutes)

  // 🔮 PLANNED: Dry run mode (not yet implemented)
  // dryRun?: boolean;     // Preview without expiring
}
```

**Example:**

```typescript
// Background job to clean up idle sessions
const result = await cortex.sessions.expireIdle({
  tenantId: "tenant-abc",
});
console.log(`Expired ${result.expired} idle sessions`);

// Custom idle timeout (15 minutes)
const customResult = await cortex.sessions.expireIdle({
  tenantId: "tenant-abc",
  idleTimeout: 15 * 60 * 1000, // 15 minutes in ms
});
```

---

## Session Policies (Governance)

Session lifecycle timeouts are configurable via the Governance API.

```typescript
await cortex.governance.setPolicy({
  organizationId: "org-123",

  // Session lifecycle configuration
  sessions: {
    lifecycle: {
      idleTimeout: "30m", // Duration before session becomes idle
      maxDuration: "24h", // Maximum session duration regardless of activity
      autoExtend: true, // Automatically extend on activity
      warnBeforeExpiry: "5m", // Optional: warn user before expiry
    },
    cleanup: {
      autoExpireIdle: true, // Automatically expire idle sessions
      deleteEndedAfter: "30d", // Delete ended sessions after 30 days
      archiveAfter: "7d", // Optional: archive before deletion
    },
    limits: {
      maxActiveSessions: 10, // Optional: max concurrent sessions per user
      maxSessionsPerDevice: 3, // Optional: max sessions per device type
    },
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

Sessions integrate with the Auth Context system for tenant isolation:

```typescript
import { createAuthContext } from "@cortex-platform/sdk";

// Create auth context with session info
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

// tenantId is automatically injected from auth context
// This provides tenant isolation without passing tenantId to every call
const session = await cortex.sessions.create({
  userId: "user-123",
  // tenantId is auto-injected from auth context
  metadata: { deviceType: "web" },
});

// Queries are automatically scoped to the tenant
const sessions = await cortex.sessions.list({
  userId: "user-123",
  // tenantId is auto-injected, only returns sessions for this tenant
});
```

> **Note:** The `sessionId` in AuthContext is for reference/tracking purposes.
> Session activity tracking (incrementing message/memory counts) should be done
> explicitly by calling `touch()` on user interactions.

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

### SessionValidationError

The Sessions API throws `SessionValidationError` for client-side validation failures:

```typescript
import { SessionValidationError } from "@cortex-platform/sdk";

try {
  await cortex.sessions.create({
    userId: "", // Invalid: empty userId
  });
} catch (error) {
  if (error instanceof SessionValidationError) {
    console.log(`Validation error: ${error.message}`);
    console.log(`Code: ${error.code}`); // e.g., "EMPTY_USER_ID"
    console.log(`Field: ${error.field}`); // e.g., "userId"
  }
}
```

**Validation Error Codes:**

| Code                      | Description                               |
| ------------------------- | ----------------------------------------- |
| `INVALID_SESSION_ID`      | sessionId must be a string                |
| `EMPTY_SESSION_ID`        | sessionId cannot be empty                 |
| `SESSION_ID_TOO_LONG`     | sessionId cannot exceed 256 characters    |
| `INVALID_USER_ID`         | userId must be a string                   |
| `EMPTY_USER_ID`           | userId cannot be empty                    |
| `USER_ID_TOO_LONG`        | userId cannot exceed 256 characters       |
| `INVALID_TENANT_ID`       | tenantId must be a string                 |
| `EMPTY_TENANT_ID`         | tenantId cannot be empty                  |
| `TENANT_ID_TOO_LONG`      | tenantId cannot exceed 256 characters     |
| `INVALID_STATUS`          | status must be a string                   |
| `INVALID_STATUS_VALUE`    | status must be: active, idle, or ended    |
| `INVALID_PARAMS`          | Session params must be an object          |
| `MISSING_USER_ID`         | userId is required                        |
| `INVALID_MEMORY_SPACE_ID` | memorySpaceId must be a string            |
| `INVALID_EXPIRES_AT`      | expiresAt must be a positive number       |
| `INVALID_METADATA`        | metadata must be a plain object           |
| `INVALID_FILTERS`         | Session filters must be an object         |
| `INVALID_LIMIT`           | limit must be a number between 1 and 1000 |
| `INVALID_OFFSET`          | offset must be a non-negative number      |

### Runtime Errors

Backend operations throw standard `Error` for runtime failures:

```typescript
try {
  await cortex.sessions.touch("non-existent-session");
} catch (error) {
  if (error instanceof Error) {
    // Error message: "Session not found: non-existent-session"
    console.log(error.message);
  }
}
```

> **🔮 PLANNED:** Session-specific error codes (`CortexErrorCode.SESSION_NOT_FOUND`,
> `CortexErrorCode.SESSION_EXPIRED`, `CortexErrorCode.SESSION_ALREADY_ENDED`) are
> planned for a future release to provide more structured error handling.

---

## Related APIs

- [User Operations](./04-user-operations.md) - User profiles and GDPR deletion
- [Auth Integration](../08-integrations/auth-providers.md) - Authentication context
- [Governance Policies](./10-governance-policies-api.md) - Session lifecycle policies
- [Memory Operations](./02-memory-operations.md) - Session-scoped memories
