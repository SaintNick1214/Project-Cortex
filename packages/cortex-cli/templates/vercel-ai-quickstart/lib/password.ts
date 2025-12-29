/**
 * Password Hashing Utilities
 *
 * Uses Web Crypto API (PBKDF2) for password hashing.
 * Works in Edge runtime - no external dependencies.
 */

const ITERATIONS = 100000;
const KEY_LENGTH = 256;
const SALT_LENGTH = 16;

/**
 * Hash a password using PBKDF2
 *
 * @param password - Plain text password to hash
 * @returns Hashed password as base64 string (format: salt:hash)
 */
export async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const passwordBuffer = encoder.encode(password);

  // Generate random salt
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));

  // Import password as key material
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    passwordBuffer,
    "PBKDF2",
    false,
    ["deriveBits"]
  );

  // Derive key using PBKDF2
  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt,
      iterations: ITERATIONS,
      hash: "SHA-256",
    },
    keyMaterial,
    KEY_LENGTH
  );

  // Convert to base64 strings
  const saltB64 = btoa(String.fromCharCode(...salt));
  const hashB64 = btoa(String.fromCharCode(...new Uint8Array(derivedBits)));

  // Return combined format: salt:hash
  return `${saltB64}:${hashB64}`;
}

/**
 * Verify a password against a stored hash
 *
 * @param password - Plain text password to verify
 * @param storedHash - Previously hashed password (format: salt:hash)
 * @returns True if password matches
 */
export async function verifyPassword(
  password: string,
  storedHash: string
): Promise<boolean> {
  try {
    const [saltB64, expectedHashB64] = storedHash.split(":");
    if (!saltB64 || !expectedHashB64) {
      return false;
    }

    const encoder = new TextEncoder();
    const passwordBuffer = encoder.encode(password);

    // Decode salt from base64
    const saltStr = atob(saltB64);
    const salt = new Uint8Array(saltStr.length);
    for (let i = 0; i < saltStr.length; i++) {
      salt[i] = saltStr.charCodeAt(i);
    }

    // Import password as key material
    const keyMaterial = await crypto.subtle.importKey(
      "raw",
      passwordBuffer,
      "PBKDF2",
      false,
      ["deriveBits"]
    );

    // Derive key using same parameters
    const derivedBits = await crypto.subtle.deriveBits(
      {
        name: "PBKDF2",
        salt,
        iterations: ITERATIONS,
        hash: "SHA-256",
      },
      keyMaterial,
      KEY_LENGTH
    );

    // Compare hashes
    const hashB64 = btoa(String.fromCharCode(...new Uint8Array(derivedBits)));
    return hashB64 === expectedHashB64;
  } catch {
    return false;
  }
}

/**
 * Generate a secure random session token
 *
 * @returns Random token as hex string
 */
export function generateSessionToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
