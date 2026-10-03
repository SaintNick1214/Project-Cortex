import { describe, expect, it } from "@jest/globals";
import { ConvexError } from "convex/values";
import * as memories from "../../../convex-dev/memories";
import * as facts from "../../../convex-dev/facts";
import { harness, identity, memoryStoreArgs, factStoreArgs } from "./sharedfixtures";

const operations = [
  ["memories.store", memories.store, memoryStoreArgs],
  ["memories.update", memories.update, { memorySpaceId: "space-a", memoryId: "target", importance: 77 }],
  ["memories.updateMany", memories.updateMany, { memorySpaceId: "space-a", importance: 77 }],
  ["facts.store", facts.store, factStoreArgs],
  ["facts.update", facts.update, { memorySpaceId: "space-a", factId: "target", confidence: 88 }],
] as const;
const envelope = () => ({ version: 1, code: "FORBIDDEN", message: "Access denied", retryable: false, outcome: "not_dispatched" });
const failed = { version: 1, code: "BACKEND_OPERATION_FAILED", message: "Data operation failed.", retryable: false, outcome: "not_committed" };
const modes = ["exact", "code-only", "extra-private", "private-message", "data-accessor", "code-accessor", "proxy", "ordinary-error"] as const;

describe.each(operations)("%s optional READ callback origin", (name, registration, args) => {
  it.each(["sync", "rejected"] as const)("healthy initially READ-less identity retains safe receipt (%s control)", async () => {
    const h = harness(); const writer = await h.provisionScope({ capabilities: ["write"] });
    if (name.includes("update")) await h.seedData(name.startsWith("memories") ? "memories" : "facts", writer, "target");
    const before = structuredClone(h.db.rows);
    expect(await h.invoke(registration, args)).toMatchObject({ mutationReceipt: true });
    expect(h.db.rows).not.toEqual(before);
  });
  for (const timing of ["sync", "rejected"] as const) {
    it.each(modes)(`${timing} %s identity failure aborts with opaque error, zero diagnostic getters and full rollback`, async mode => {
      const h = harness(); const writer = await h.provisionScope({ capabilities: ["write"] });
      if (name.includes("update")) await h.seedData(name.startsWith("memories") ? "memories" : "facts", writer, "target");
      const before = structuredClone(h.db.rows); let injected = 0; let diagnosticReads = 0;
      const payload = mode === "code-only" ? { code: "FORBIDDEN" }
        : mode === "extra-private" ? { ...envelope(), privateDiagnostic: "SYNTHETIC_PRIVATE_DIAGNOSTIC" }
        : mode === "private-message" ? { ...envelope(), message: "SYNTHETIC_PRIVATE_DIAGNOSTIC" } : envelope();
      let error: object = mode === "ordinary-error" ? new Error("SYNTHETIC_PRIVATE_DIAGNOSTIC") : new ConvexError(payload);
      if (mode === "data-accessor") Object.defineProperty(error, "data", { get() { diagnosticReads++; return envelope(); } });
      if (mode === "code-accessor") Object.defineProperty(payload, "code", { get() { diagnosticReads++; return "FORBIDDEN"; } });
      if (mode === "proxy") error = new Proxy({}, { get() { diagnosticReads++; throw new Error("SYNTHETIC_PRIVATE_DIAGNOSTIC"); },
        getPrototypeOf() { diagnosticReads++; throw new Error("SYNTHETIC_PRIVATE_DIAGNOSTIC"); },
        getOwnPropertyDescriptor() { diagnosticReads++; throw new Error("SYNTHETIC_PRIVATE_DIAGNOSTIC"); } });
      h.ctx.auth.getUserIdentity = () => {
        if ((new Error().stack ?? "").includes("optionalMutationRead")) {
          injected++;
          if (timing === "sync") throw error;
          return Promise.reject(error);
        }
        return Promise.resolve({ ...identity, tokenIdentifier: "test-identity" });
      };
      await expect(h.invoke(registration, args)).rejects.toMatchObject({ data: failed });
      expect(injected).toBeGreaterThan(0); expect(diagnosticReads).toBe(0); expect(h.db.rows).toEqual(before);
    });
  }
  it.each(["sync", "rejected"] as const)("%s low-level authority callback cannot be pruned as missing READ", async timing => {
    const h = harness(); const writer = await h.provisionScope({ capabilities: ["write"] });
    if (name.includes("update")) await h.seedData(name.startsWith("memories") ? "memories" : "facts", writer, "target");
    const before = structuredClone(h.db.rows); const get = h.db.get.bind(h.db); let injected = 0;
    h.db.get = (...parameters: Parameters<typeof get>) => {
      if ((new Error().stack ?? "").includes("optionalMutationRead")) {
        injected++; const error = new ConvexError(envelope());
        if (timing === "sync") throw error;
        return Promise.reject(error);
      }
      return get(...parameters);
    };
    await expect(h.invoke(registration, args)).rejects.toMatchObject({ data: failed });
    expect(injected).toBeGreaterThan(0); expect(h.db.rows).toEqual(before);
  });
});
