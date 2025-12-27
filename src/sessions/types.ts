/**
 * Cortex SDK - Sessions API Types
 *
 * Fully extensible session management types.
 */

/**
 * Session status
 */
export type SessionStatus = "active" | "idle" | "ended";

/**
 * Session metadata - fully extensible
 *
 * Suggested fields (all optional, add any custom fields):
 * - device: string (e.g., "Chrome on macOS")
 * - browser: string (e.g., "Chrome 120")
 * - browserVersion: string
 * - os: string (e.g., "macOS 14.0")
 * - deviceType: string (e.g., "desktop", "mobile", "tablet")
 * - ip: string
 * - location: string (e.g., "San Francisco, CA")
 * - timezone: string (e.g., "America/Los_Angeles")
 * - language: string (e.g., "en-US")
 * - userAgent: string
 *
 * Add any custom fields your application needs.
 */
export interface SessionMetadata {
  /** Device description (e.g., "Chrome on macOS") */
  device?: string;

  /** Browser name */
  browser?: string;

  /** Browser version */
  browserVersion?: string;

  /** Operating system */
  os?: string;

  /** Device type: desktop, mobile, tablet */
  deviceType?: "desktop" | "mobile" | "tablet" | string;

  /** Client IP address */
  ip?: string;

  /** Geographic location */
  location?: string;

  /** Timezone identifier */
  timezone?: string;

  /** Language preference */
  language?: string;

  /** Full user agent string */
  userAgent?: string;

  /** Any additional custom fields */
  [key: string]: unknown;
}

/**
 * Session record stored in Convex
 */
export interface Session {
  /** Convex document ID */
  _id: string;

  /** Unique session identifier */
  sessionId: string;

  /** User this session belongs to */
  userId: string;

  /** Tenant ID for multi-tenant applications */
  tenantId?: string;

  /** Memory space associated with this session */
  memorySpaceId?: string;

  /** Current session status */
  status: SessionStatus;

  /** When the session started (ms since epoch) */
  startedAt: number;

  /** When the session was last active (ms since epoch) */
  lastActiveAt: number;

  /** When the session ended (ms since epoch) */
  endedAt?: number;

  /** When the session expires (ms since epoch) */
  expiresAt?: number;

  /** Fully extensible metadata */
  metadata?: SessionMetadata;

  /** Number of messages in this session */
  messageCount: number;

  /** Number of memories created in this session */
  memoryCount: number;
}

/**
 * Parameters for creating a session
 */
export interface CreateSessionParams {
  /** Optional session ID (auto-generated if not provided) */
  sessionId?: string;

  /** User ID (required) */
  userId: string;

  /** Tenant ID for multi-tenant applications */
  tenantId?: string;

  /** Memory space to associate with this session */
  memorySpaceId?: string;

  /** Session expiration time (ms since epoch) */
  expiresAt?: number;

  /** Fully extensible metadata */
  metadata?: SessionMetadata;
}

/**
 * Filters for listing sessions
 */
export interface SessionFilters {
  /** Filter by user ID */
  userId?: string;

  /** Filter by tenant ID */
  tenantId?: string;

  /** Filter by memory space ID */
  memorySpaceId?: string;

  /** Filter by session status */
  status?: SessionStatus;

  /** Maximum results to return */
  limit?: number;

  /** Offset for pagination */
  offset?: number;
}

/**
 * Options for expiring idle sessions
 */
export interface ExpireSessionsOptions {
  /** Only expire sessions for this tenant */
  tenantId?: string;

  /** Idle timeout in milliseconds (default: 30 minutes) */
  idleTimeout?: number;
}

/**
 * Result from ending sessions
 */
export interface EndSessionsResult {
  /** Number of sessions ended */
  ended: number;

  /** Session IDs that were ended */
  sessionIds: string[];
}
