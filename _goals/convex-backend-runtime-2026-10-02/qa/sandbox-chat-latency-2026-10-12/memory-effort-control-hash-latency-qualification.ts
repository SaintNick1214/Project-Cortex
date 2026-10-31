/** Temporary internal-only zero-inference SHA-256 qualification.
 * Copy only to an owned disposable functions directory after Root closes the
 * frozen-product qualification. Never ship this fixture in the SDK.
 * Internal registration is the access boundary; the handler uses no context,
 * database, authentication/token APIs, network, scheduler or model provider.
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
const BUDGET_MS = 4000;
type Method = "webcrypto" | "fast-sha256";
type Sample = { method: Method; input: "short" | "long32KiB"; utf8Bytes: number; requested: number; completed: number;
  encodeMs: number; digestMs: number; hexMs: number; totalMs: number; expectedSha256: string };

export const compare = internalQueryGeneric({
  args: {
    order: v.union(v.literal("webcrypto-first"), v.literal("fast-first")),
    counts: v.union(v.literal("pilot"), v.literal("full")),
  },
  handler: async (_ctx, args) => {
    // Date.now() is deterministic within Convex execution and is unsuitable here.
    if (typeof globalThis.performance?.now !== "function") throw Error("HASH_BENCHMARK_MONOTONIC_CLOCK_UNAVAILABLE");
    let previous = -Infinity;
    const now = () => {
      const value = globalThis.performance.now();
      if (!Number.isFinite(value) || value < previous) throw Error("HASH_BENCHMARK_INVALID_MONOTONIC_CLOCK");
      previous = value; return value;
    };
    const started = now(), encoder = new TextEncoder(), samples: Sample[] = [];
    const methods: Method[] = args.order === "webcrypto-first" ? ["webcrypto", "fast-sha256"] : ["fast-sha256", "webcrypto"];
    let incomplete = false;
    for (const method of methods) {
      for (const data of DATA) {
        const requested = (data.name === "short" ? 10 : 1) * (args.counts === "full" ? 10 : 1);
        const sample: Sample = { method, input: data.name, utf8Bytes: encoder.encode(data.value).byteLength, requested,
          completed: 0, encodeMs: 0, digestMs: 0, hexMs: 0, totalMs: 0, expectedSha256: data.expected };
        const segmentStarted = now();
        for (let index = 0; index < requested; index++) {
          if (now() - started >= BUDGET_MS) { incomplete = true; break; }
          const encodeStarted = now(), bytes = encoder.encode(data.value), digestStarted = now();
          sample.encodeMs += digestStarted - encodeStarted;
          // Exact semanticHash WebCrypto call versus the existing createSha256
          // Hash.update/digest implementation, with identical UTF-8 and hex work.
          const digest = method === "webcrypto"
            ? new Uint8Array(await globalThis.crypto.subtle.digest("SHA-256", bytes))
            : new Hash().update(bytes).digest();
          const hexStarted = now(); sample.digestMs += hexStarted - digestStarted;
          const actual = Array.from(digest, byte => byte.toString(16).padStart(2, "0")).join("");
          sample.hexMs += now() - hexStarted;
          if (actual !== data.expected) throw Error("HASH_BENCHMARK_SHA256_PARITY_FAILED");
          sample.completed++;
        }
        sample.totalMs = now() - segmentStarted; samples.push(sample);
        if (incomplete) break;
      }
      if (incomplete) break;
    }
    const totalMs = now() - started;
    if (totalMs <= 0) throw Error("HASH_BENCHMARK_CLOCK_DID_NOT_ADVANCE");
    // The cooperative budget prevents another digest after 4s; it cannot cancel
    // one already-running WebCrypto syscall. INCOMPLETE is never a timing PASS.
    return { version: 1 as const, status: incomplete ? "INCOMPLETE_BUDGET" as const : "COMPLETE" as const,
      order: args.order, counts: args.counts, clock: "performance.now" as const, budgetMs: BUDGET_MS, totalMs,
      parity: !incomplete, completedDigests: samples.reduce((sum, sample) => sum + sample.completed, 0), samples,
      dbReads: 0, dbWrites: 0, networkCalls: 0, tokenCalls: 0, inferenceCalls: 0 };
  },
});
