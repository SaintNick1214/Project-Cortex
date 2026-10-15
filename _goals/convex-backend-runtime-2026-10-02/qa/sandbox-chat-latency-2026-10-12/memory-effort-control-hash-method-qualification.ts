/** New fixed-method zero-inference experiment. No internal clock or timed loop.
 * Internal admin-only registration, fixed110digests; no context/DB/network/token use.
 * This replaces only the exact prior QA file in the owned disposable host.
 */
import { internalQueryGeneric } from "convex/server";
import { v } from "convex/values";
import { Hash } from "fast-sha256";

const SHORT = "{\"version\":8,\"kind\":\"selection\",\"role\":\"user\",\"content\":\"café 🙂\",\"revision\":1,\"principal\":\"qualification-only\"}";
const LONG_PREFIX = "{\"version\":8,\"kind\":\"model-candidate\",\"model\":\"qualification-only\",\"messages\":[{\"role\":\"user\",\"content\":\"";
const LONG_SUFFIX = "\"}]}";
const LONG = LONG_PREFIX + "x".repeat(32768 - LONG_PREFIX.length - LONG_SUFFIX.length) + LONG_SUFFIX;
const DATA = [
  { name: "short" as const, value: SHORT, expected: "e9db45c3f7a86685e25cc656449043585dd2e8312db159685efc8da983deb769" },
  { name: "long32KiB" as const, value: LONG, expected: "ae25c6e6777943907af501f13f16b7d32adf92dc88047a10c048f58775a5821b" },
];

export const fixedMethod = internalQueryGeneric({
  args: { method: v.union(v.literal("webcrypto"), v.literal("fast-sha256")) },
  handler: async (_ctx, args) => {
    const encoder = new TextEncoder(), samples = [];
    for (const data of DATA) {
      const requested = data.name === "short" ? 100 : 10;
      for (let index = 0; index < requested; index++) {
        const bytes = encoder.encode(data.value);
        const digest = args.method === "webcrypto"
          ? new Uint8Array(await globalThis.crypto.subtle.digest("SHA-256", bytes))
          : new Hash().update(bytes).digest();
        const actual = Array.from(digest, byte => byte.toString(16).padStart(2, "0")).join("");
        if (actual !== data.expected) throw Error("HASH_METHOD_SHA256_PARITY_FAILED");
      }
      samples.push({ method: args.method, input: data.name, utf8Bytes: encoder.encode(data.value).byteLength,
        requested, completed: requested, expectedSha256: data.expected });
    }
    return { version: 1 as const, experiment: "fixed-method-official-native-time-v1" as const,
      status: "COMPLETE" as const, method: args.method, parity: true, completedDigests: 110, samples,
      internalClockCalls: 0, dbReads: 0, dbWrites: 0, networkCalls: 0, tokenCalls: 0, inferenceCalls: 0 };
  },
});
