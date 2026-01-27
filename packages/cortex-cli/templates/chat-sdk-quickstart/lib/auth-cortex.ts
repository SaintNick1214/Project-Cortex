/**
 * Auth.js to Cortex Auth Context Bridge
 *
 * Helpers to extract authentication context from Auth.js sessions
 * and convert to Cortex SDK AuthContext format.
 */

import { auth } from "@/app/(auth)/auth";
import {
  createAuthContext,
  type AuthContext,
} from "@cortexmemory/sdk";

/**
 * Session type from Auth.js
 */
export interface AuthSession {
  user?: {
    id?: string;
    email?: string | null;
    name?: string | null;
    type?: string;
  };
  expires?: string;
}

/**
 * Get Cortex AuthContext from the current Auth.js session.
 *
 * Call this in API routes to get a properly formatted auth context
 * that can be passed to Cortex SDK operations.
 *
 * @returns AuthContext if user is authenticated, null otherwise
 *
 * @example
 * ```typescript
 * const authContext = await getCortexAuthContext();
 * if (!authContext) {
 *   return new Response("Unauthorized", { status: 401 });
 * }
 * const cortex = getCortexWithAuth(authContext);
 * ```
 */
export async function getCortexAuthContext(): Promise<AuthContext | null> {
  const session = await auth();

  if (!session?.user?.id) {
    return null;
  }

  return createAuthContext({
    userId: session.user.id,
    authProvider: "nextauth",
    authMethod: "session",
    authenticatedAt: Date.now(),
    metadata: {
      email: session.user.email ?? undefined,
      name: session.user.name ?? undefined,
      userType: session.user.type,
    },
  });
}

/**
 * Create Cortex AuthContext from an existing session object.
 *
 * Use this when you already have the session (e.g., from middleware
 * or a previous auth() call) and want to avoid a duplicate auth check.
 *
 * @param session - Auth.js session object
 * @returns AuthContext if session has valid user, null otherwise
 *
 * @example
 * ```typescript
 * const session = await auth();
 * if (session?.user) {
 *   const authContext = createCortexAuthContextFromSession(session);
 *   // Use authContext...
 * }
 * ```
 */
export function createCortexAuthContextFromSession(
  session: AuthSession | null,
): AuthContext | null {
  if (!session?.user?.id) {
    return null;
  }

  return createAuthContext({
    userId: session.user.id,
    authProvider: "nextauth",
    authMethod: "session",
    authenticatedAt: Date.now(),
    metadata: {
      email: session.user.email ?? undefined,
      name: session.user.name ?? undefined,
      userType: session.user.type,
    },
  });
}

/**
 * Extract userId from session with fallback.
 *
 * Provides a safe way to get userId with explicit handling of
 * unauthenticated cases. Use this for logging or non-critical paths.
 *
 * @param session - Auth.js session object (or null)
 * @param fallback - Value to return if no user ID (defaults to "anonymous")
 * @returns User ID or fallback value
 *
 * @example
 * ```typescript
 * const session = await auth();
 * const userId = getUserIdFromSession(session);
 * console.log(`Request from user: ${userId}`);
 * ```
 */
export function getUserIdFromSession(
  session: AuthSession | null,
  fallback: string = "anonymous",
): string {
  return session?.user?.id ?? fallback;
}

/**
 * Check if a session represents an authenticated user.
 *
 * @param session - Auth.js session object
 * @returns true if session has a valid user ID
 */
export function isAuthenticated(session: AuthSession | null): boolean {
  return Boolean(session?.user?.id);
}
