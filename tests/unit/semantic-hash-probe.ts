/** Test-only async digest seam. Defaults to the real semanticHash implementation;
 * existing collision/failure/interleaving tests replace this port, never JWT/HMAC.
 */
import { jest } from "@jest/globals";
const actual = await import("../../src/domain/profile");
export const semanticHashDigest: Pick<typeof globalThis.crypto.subtle, "digest"> = {
  digest: async (_algorithm, data) => {
    const result = await actual.semanticHash(new TextDecoder("utf-8", { ignoreBOM: true }).decode(data));
    return Uint8Array.from(result.match(/../g)!, byte => Number.parseInt(byte, 16)).buffer;
  },
};
jest.unstable_mockModule("../../src/domain/profile", () => ({ ...actual,
  semanticHash: async (value: string): Promise<string> => {
    const bytes = await semanticHashDigest.digest("SHA-256", new TextEncoder().encode(value));
    return Array.from(new Uint8Array(bytes), byte => byte.toString(16).padStart(2, "0")).join("");
  },
}));
