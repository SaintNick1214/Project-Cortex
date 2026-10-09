import { jest } from "@jest/globals";
import { ConvexError } from "convex/values";
import type { ConvexClient } from "convex/browser";
import { ResilienceLayer } from "../../src/resilience";
import { FactsAPI } from "../../src/facts";
import { FactCommitOutcomeUnknownError } from "../../src/facts/history";

it("preserves genuine backend refusal type/data while dropping server diagnostic frames", async () => {
  const resilience = new ResilienceLayer({ enabled: true, concurrency: { maxConcurrent: 10 }, rateLimiter: { bucketSize: 100, refillRate: 100 } });
  const refusal = new ConvexError({ code: "FORBIDDEN", outcome: "not_dispatched" });
  refusal.message = "sensitive server diagnostic";
  try {
    const result = await resilience.execute(() => Promise.reject(refusal), "facts:update").catch((error: unknown) => error);
    expect(result).toBeInstanceOf(ConvexError);
    expect((result as ConvexError<{ code: string; outcome: string }>).data).toEqual(refusal.data);
    expect((result as Error).message).not.toContain("sensitive server diagnostic");
  } finally { resilience.stopQueueProcessor(); }
});

it.each([new Error("connection lost"), Object.assign(new Error("connection lost"), { data: "FACT_HISTORY_SOURCE_REQUIRED" })])("does not turn a transport error/data-shaped object into a backend refusal: %p", async transportError => {
  const resilience = new ResilienceLayer({ enabled: true, concurrency: { maxConcurrent: 10 }, rateLimiter: { bucketSize: 100, refillRate: 100 } });
  try {
    const result = await resilience.execute(() => Promise.reject(transportError), "facts:update").catch((error: unknown) => error);
    expect(result).toBe(transportError);
    expect(result).not.toBeInstanceOf(ConvexError);
  } finally { resilience.stopQueueProcessor(); }
});

it.each([
  { error: new ConvexError("FACT_HISTORY_SOURCE_REQUIRED"), unknown: false },
  { error: new Error("connection lost after send"), unknown: true },
])("classifies a fact update backend refusal vs unresolved transport: %p", async ({ error, unknown }) => {
  const resilience = new ResilienceLayer({ enabled: true, concurrency: { maxConcurrent: 10 }, rateLimiter: { bucketSize: 100, refillRate: 100 } });
  const mutation = jest.fn<ConvexClient["mutation"]>().mockRejectedValue(error);
  const client = { mutation } as unknown as ConvexClient;
  const facts = new FactsAPI(client, undefined, resilience);
  try {
    const result = await facts.update("memspace-owned", "fact-owned", { fact: "new content" }).catch((failure: unknown) => failure);
    if (unknown) expect(result).toBeInstanceOf(FactCommitOutcomeUnknownError);
    else { expect(result).not.toBeInstanceOf(FactCommitOutcomeUnknownError); expect((result as Error).message).toBe("FACT_HISTORY_SOURCE_REQUIRED"); }
    // The configured retry layer keeps the same operationId. Preserve genuine
    // backend refusals separately from a transport that remains unresolved.
    expect(mutation).toHaveBeenCalledTimes(unknown ? 4 : 1);
    expect(new Set(mutation.mock.calls.map(call => call[1].operationId)).size).toBe(1);
  } finally { resilience.stopQueueProcessor(); }
});
