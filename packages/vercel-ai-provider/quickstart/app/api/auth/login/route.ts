/**
 * User Login API Route
 *
 * POST: Authenticate user and return session
 */

import { getCortex } from "@/lib/cortex";
import { verifyPassword, generateSessionToken } from "@/lib/password";

/**
 * Validates login request body structure.
 * Returns validated credentials or null if invalid.
 */
function validateLoginBody(
  body: unknown
): { username: string; password: string } | null {
  if (typeof body !== "object" || body === null) {
    return null;
  }

  const record = body as Record<string, unknown>;

  // Validate username field exists and is a non-empty string
  const hasValidUsername =
    "username" in record &&
    typeof record.username === "string" &&
    record.username.length > 0 &&
    record.username.length <= 256;

  // Validate password field exists and is a non-empty string
  const hasValidPassword =
    "password" in record &&
    typeof record.password === "string" &&
    record.password.length > 0 &&
    record.password.length <= 1024;

  if (!hasValidUsername || !hasValidPassword) {
    return null;
  }

  return {
    username: record.username as string,
    password: record.password as string,
  };
}

/**
 * Safely extracts an error message for logging without exposing user data.
 */
function getSafeErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    // Only include error name and a sanitized message
    // Avoid logging full stack traces which may contain user data
    return `${error.name}: ${error.message.slice(0, 200)}`;
  }
  return "Unknown error";
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    // Validate input structure before extracting values
    const credentials = validateLoginBody(body);
    if (!credentials) {
      return Response.json(
        { error: "Username and password are required" },
        { status: 400 }
      );
    }

    const { username, password } = credentials;

    const cortex = getCortex();
    const sanitizedUsername = username.toLowerCase();

    // Get user profile
    const user = await cortex.users.get(sanitizedUsername);
    if (!user) {
      return Response.json(
        { error: "Invalid username or password" },
        { status: 401 }
      );
    }

    // Verify password
    const storedHash = user.data.passwordHash as string;
    if (!storedHash) {
      return Response.json(
        { error: "Invalid username or password" },
        { status: 401 }
      );
    }

    const isValid = await verifyPassword(password, storedHash);
    if (!isValid) {
      return Response.json(
        { error: "Invalid username or password" },
        { status: 401 }
      );
    }

    // Update last login time
    await cortex.users.update(sanitizedUsername, {
      lastLoginAt: Date.now(),
    });

    // Generate session token
    const sessionToken = generateSessionToken();

    return Response.json({
      success: true,
      user: {
        id: sanitizedUsername,
        displayName: (user.data.displayName as string) || sanitizedUsername,
      },
      sessionToken,
    });
  } catch (error) {
    // Log sanitized error to prevent log injection
    console.error("[Login Error]", getSafeErrorMessage(error));

    return Response.json(
      { error: "Failed to authenticate" },
      { status: 500 }
    );
  }
}
