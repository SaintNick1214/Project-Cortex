/**
 * User Registration API Route
 *
 * POST: Register a new user account
 */

import { getCortex } from "@/lib/cortex";
import { hashPassword, generateSessionToken } from "@/lib/password";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { username, password, displayName } = body;

    // Validate input
    if (!username || typeof username !== "string") {
      return Response.json({ error: "Username is required" }, { status: 400 });
    }

    if (!password || typeof password !== "string") {
      return Response.json({ error: "Password is required" }, { status: 400 });
    }

    if (username.length < 2) {
      return Response.json(
        { error: "Username must be at least 2 characters" },
        { status: 400 },
      );
    }

    if (password.length < 4) {
      return Response.json(
        { error: "Password must be at least 4 characters" },
        { status: 400 },
      );
    }

    // Sanitize username (alphanumeric, underscore, hyphen only)
    const sanitizedUsername = username
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, "");
    if (sanitizedUsername !== username.toLowerCase()) {
      return Response.json(
        {
          error:
            "Username can only contain letters, numbers, underscores, and hyphens",
        },
        { status: 400 },
      );
    }

    const cortex = getCortex();

    // Check if user already exists
    const existingUser = await cortex.users.get(sanitizedUsername);
    if (existingUser) {
      return Response.json(
        { error: "Username already taken" },
        { status: 409 },
      );
    }

    // Hash password and create user profile
    const passwordHash = await hashPassword(password);
    const now = Date.now();

    await cortex.users.update(sanitizedUsername, {
      displayName: displayName || sanitizedUsername,
      passwordHash,
      createdAt: now,
      lastLoginAt: now,
    });

    // Generate session token
    const sessionToken = generateSessionToken();

    return Response.json({
      success: true,
      user: {
        id: sanitizedUsername,
        displayName: displayName || sanitizedUsername,
      },
      sessionToken,
    });
  } catch (error) {
    console.error("[Register Error]", error);

    return Response.json({ error: "Failed to register user" }, { status: 500 });
  }
}
