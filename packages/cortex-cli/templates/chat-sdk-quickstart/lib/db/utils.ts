/**
 * Database utility functions
 *
 * These are used for local development authentication
 * with guest/demo accounts.
 */

/**
 * Generate a dummy password for guest accounts
 * This is used for development/demo purposes only
 */
export function generateDummyPassword(): string {
  // Use a fixed password for guest accounts in development
  // In production, this should be replaced with proper authentication
  return "guest-password-" + Math.random().toString(36).substring(2, 15);
}

/**
 * Hash a password for storage
 * Note: In production, use bcrypt or similar
 */
export async function hashPassword(password: string): Promise<string> {
  // For demo purposes, use a simple hash
  // In production, use bcrypt: await bcrypt.hash(password, 10)
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Verify a password against a hash
 */
export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  const passwordHash = await hashPassword(password);
  return passwordHash === hash;
}
