/**
 * Database utility functions
 *
 * These are used for local development authentication
 * with guest/demo accounts.
 */

/**
 * Generate a cryptographically secure random string
 */
function secureRandomString(length: number): string {
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return Array.from(array, (byte) => byte.toString(16).padStart(2, "0")).join("").slice(0, length);
}

/**
 * Generate a dummy password for guest accounts
 * This is used for development/demo purposes only
 * Uses crypto.getRandomValues() for secure randomness
 */
export function generateDummyPassword(): string {
  // Use cryptographically secure random for guest account passwords
  // In production, this should be replaced with proper authentication
  return "guest-password-" + secureRandomString(16);
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
