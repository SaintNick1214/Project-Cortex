/**
 * User Login API Route
 *
 * POST: Authenticate user and return session
 */

import { getCortex } from "@/lib/cortex";
import { verifyPassword, generateSessionToken } from "@/lib/password";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { username, password } = body;

    // Validate input
    if (!username || typeof username !== "string") {
      return Response.json(
        { error: "Username is required" },
        { status: 400 }
      );
    }

    if (!password || typeof password !== "string") {
      return Response.json(
        { error: "Password is required" },
        { status: 400 }
      );
    }

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
    console.error("[Login Error]", error);

    return Response.json(
      { error: "Failed to authenticate" },
      { status: 500 }
    );
  }
}
