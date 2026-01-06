/**
 * Unit Tests: Password Utilities
 *
 * Tests password hashing, verification, and session token generation.
 */

import {
  hashPassword,
  verifyPassword,
  generateSessionToken,
} from "../../lib/password";

describe("Password Utilities", () => {
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // hashPassword
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("hashPassword", () => {
    it("should return hash in salt:hash format", async () => {
      const hash = await hashPassword("testpassword");

      expect(hash).toContain(":");
      const [salt, hashPart] = hash.split(":");
      expect(salt).toBeDefined();
      expect(hashPart).toBeDefined();
      expect(salt.length).toBeGreaterThan(0);
      expect(hashPart.length).toBeGreaterThan(0);
    });

    it("should produce different hashes for same password (unique salts)", async () => {
      const hash1 = await hashPassword("samepassword");
      const hash2 = await hashPassword("samepassword");

      expect(hash1).not.toBe(hash2);

      // Salts should be different
      const [salt1] = hash1.split(":");
      const [salt2] = hash2.split(":");
      expect(salt1).not.toBe(salt2);
    });

    it("should produce base64-encoded output", async () => {
      const hash = await hashPassword("testpassword");
      const [salt, hashPart] = hash.split(":");

      // Base64 regex pattern
      const base64Pattern = /^[A-Za-z0-9+/]+=*$/;
      expect(salt).toMatch(base64Pattern);
      expect(hashPart).toMatch(base64Pattern);
    });

    it("should handle empty password", async () => {
      const hash = await hashPassword("");

      expect(hash).toContain(":");
      const [salt, hashPart] = hash.split(":");
      expect(salt.length).toBeGreaterThan(0);
      expect(hashPart.length).toBeGreaterThan(0);
    });

    it("should handle special characters in password", async () => {
      const hash = await hashPassword("p@$$w0rd!#$%^&*()");

      expect(hash).toContain(":");
      const verified = await verifyPassword("p@$$w0rd!#$%^&*()", hash);
      expect(verified).toBe(true);
    });

    it("should handle unicode characters in password", async () => {
      const hash = await hashPassword("пароль密码🔒");

      expect(hash).toContain(":");
      const verified = await verifyPassword("пароль密码🔒", hash);
      expect(verified).toBe(true);
    });

    it("should handle very long passwords", async () => {
      const longPassword = "a".repeat(1000);
      const hash = await hashPassword(longPassword);

      expect(hash).toContain(":");
      const verified = await verifyPassword(longPassword, hash);
      expect(verified).toBe(true);
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // verifyPassword
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("verifyPassword", () => {
    it("should return true for correct password", async () => {
      const password = "correctpassword";
      const hash = await hashPassword(password);

      const result = await verifyPassword(password, hash);

      expect(result).toBe(true);
    });

    it("should return false for wrong password", async () => {
      const hash = await hashPassword("correctpassword");

      const result = await verifyPassword("wrongpassword", hash);

      expect(result).toBe(false);
    });

    it("should return false for malformed hash (no colon)", async () => {
      const result = await verifyPassword("password", "invalidhashformat");

      expect(result).toBe(false);
    });

    it("should return false for malformed hash (empty parts)", async () => {
      const result = await verifyPassword("password", ":");

      expect(result).toBe(false);
    });

    it("should return false for malformed hash (only salt)", async () => {
      const result = await verifyPassword("password", "somesalt:");

      expect(result).toBe(false);
    });

    it("should return false for malformed hash (only hash)", async () => {
      const result = await verifyPassword("password", ":somehash");

      expect(result).toBe(false);
    });

    it("should return false for empty stored hash", async () => {
      const result = await verifyPassword("password", "");

      expect(result).toBe(false);
    });

    it("should return false for invalid base64 in salt", async () => {
      const result = await verifyPassword(
        "password",
        "!!!invalid!!!:validhash",
      );

      expect(result).toBe(false);
    });

    it("should be case-sensitive for passwords", async () => {
      const hash = await hashPassword("Password");

      const resultLower = await verifyPassword("password", hash);
      const resultUpper = await verifyPassword("PASSWORD", hash);
      const resultCorrect = await verifyPassword("Password", hash);

      expect(resultLower).toBe(false);
      expect(resultUpper).toBe(false);
      expect(resultCorrect).toBe(true);
    });

    it("should handle whitespace in passwords", async () => {
      const hash = await hashPassword("pass word");

      const withSpace = await verifyPassword("pass word", hash);
      const withoutSpace = await verifyPassword("password", hash);

      expect(withSpace).toBe(true);
      expect(withoutSpace).toBe(false);
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // generateSessionToken
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("generateSessionToken", () => {
    it("should return 64-character hex string", () => {
      const token = generateSessionToken();

      expect(token).toHaveLength(64);
      expect(token).toMatch(/^[0-9a-f]+$/);
    });

    it("should produce unique tokens on each call", () => {
      const tokens = new Set<string>();

      for (let i = 0; i < 100; i++) {
        tokens.add(generateSessionToken());
      }

      expect(tokens.size).toBe(100);
    });

    it("should be lowercase hex", () => {
      const token = generateSessionToken();

      expect(token).toBe(token.toLowerCase());
    });

    it("should not contain non-hex characters", () => {
      const token = generateSessionToken();

      expect(token).not.toMatch(/[g-zG-Z]/);
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Integration: Hash and Verify Round-Trip
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("hash and verify round-trip", () => {
    const testPasswords = [
      "simple",
      "with spaces",
      "UPPERCASE",
      "MixedCase123",
      "!@#$%^&*()",
      "12345678",
      "日本語パスワード",
      "emoji🔐🔑🔓",
    ];

    testPasswords.forEach((password) => {
      it(`should round-trip password: "${password}"`, async () => {
        const hash = await hashPassword(password);
        const verified = await verifyPassword(password, hash);

        expect(verified).toBe(true);
      });
    });
  });
});
