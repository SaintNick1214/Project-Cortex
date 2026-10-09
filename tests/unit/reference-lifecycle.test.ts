import { describe, it, expect } from "@jest/globals";
import {
  extractReferenceSlots,
  ownership,
  naturalIdentity,
  reserveLifecycle,
  PRIMARY_TABLES,
  lifecycleReadAllowance,
} from "../../convex-dev/lib/referenceLifecycle";
import { CaptureBudget } from "../../convex-dev/lib/factHistoryProvenance";
import schema from "../../convex-dev/schema";
const base = { tenantId: "A", memorySpaceId: "shared" };
describe("fixed physical references and actual supported values", () => {
  it("accounts every shipped primary table and exactly three derived tables", () => {
    expect(PRIMARY_TABLES).toHaveLength(17);
    expect(
      Object.keys(schema.tables)
        .filter((x) => x.startsWith("cortexReference"))
        .sort(),
    ).toEqual([
      "cortexReferenceEdges",
      "cortexReferenceState",
      "cortexReferenceTargets",
    ]);
  });
  it("counts current plus every retained file occurrence independent of visible pointer", () => {
    const slots = extractReferenceSlots("artifacts", {
      ...base,
      fileRef: { storageId: "blob" },
      versionPointer: 1,
      versionHistory: [
        { version: 1, fileRef: { storageId: "blob" } },
        { version: 2, fileRef: { storageId: "other" } },
        { version: 3, fileRef: { storageId: "blob" } },
      ],
    });
    expect(
      slots
        .filter((x) => x.storageId)
        .map((x) => [x.storageId, x.occurrences, x.slots]),
    ).toEqual([
      ["blob", 3, ["fileRef", "versionHistory:1", "versionHistory:3"]],
      ["other", 1, ["versionHistory:2"]],
    ]);
  });
  it("ignores metadata lookalikes and captures only fixed declared source fields", () => {
    const slots = extractReferenceSlots("memories", {
      ...base,
      sourceType: "system",
      metadata: {
        conversationRef: { conversationId: "forged" },
        storageId: "fake",
      },
      conversationRef: { conversationId: "declared", messageIds: [] },
    });
    expect(slots.map((s) => s.logical)).toEqual(["shared", "declared"]);
    expect(slots.filter((s) => s.authority)).toHaveLength(1);
  });
  it("records both declared authority candidates for consistent-root validation rather than dropping a conflicting source", () => {
    expect(
      extractReferenceSlots("facts", {
        ...base,
        sourceRef: { memoryId: "m", conversationId: "c" },
      })
        .filter((s) => s.authority)
        .map((s) => s.role),
    ).toEqual(["conversation", "memory"]);
  });
  it.each(["A", "B", undefined])(
    "distinguishes tenant %s and fixed profile/key qualifiers",
    (tenantId) => {
      expect(
        naturalIdentity("conversations", {
          ...base,
          tenantId,
          conversationId: "same",
        }),
      ).not.toEqual(
        naturalIdentity("conversations", {
          ...base,
          tenantId: tenantId === "A" ? "B" : "A",
          conversationId: "same",
        }),
      );
      expect(
        naturalIdentity("immutable", { ...base, type: "user", id: "same" }),
      ).not.toEqual(
        naturalIdentity("immutable", { ...base, type: "custom", id: "same" }),
      );
      expect(
        naturalIdentity("mutable", { ...base, namespace: "one", key: "same" }),
      ).not.toEqual(
        naturalIdentity("mutable", { ...base, namespace: "two", key: "same" }),
      );
    },
  );
  it("recognizes an ordinary human/assistant root and protects mixed or shared owners", () => {
    expect(
      ownership("conversations", {
        ...base,
        participants: { userId: "owner", agentId: "assistant" },
      }).ownerState,
    ).toBe("explicit");
    expect(
      ownership("memories", { ...base, userId: "owner", agentId: "agent" })
        .ownerState,
    ).toBe("conflicted");
    expect(
      ownership("artifacts", {
        ...base,
        userId: "owner",
        collaborators: [{ type: "user", role: "owner", id: "other" }],
      }).ownerState,
    ).toBe("shared");
  });
  it("changes ownership revision identity on collaborator/access changes", () => {
    expect(
      ownership("artifacts", { ...base, userId: "owner" }).ownershipDigest,
    ).not.toEqual(
      ownership("artifacts", {
        ...base,
        userId: "owner",
        collaborators: [{ type: "user", role: "viewer", id: "other" }],
      }).ownershipDigest,
    );
  });
  it("accepts an18 typed endpoint only with matching logical ID and exact scope", () => {
    const endpoint = {
      state: "known",
      scopeVersion: 1,
      tenantId: "A",
      memorySpaceId: "shared",
      logicalFactId: "f",
      factDocumentId: "physical",
    };
    expect(
      extractReferenceSlots("facts", {
        ...base,
        supersedes: "f",
        supersedesEndpoint: endpoint,
      }).find((s) => s.role === "fact-supersedes")?.physical,
    ).toBe("physical");
    expect(
      extractReferenceSlots("facts", {
        ...base,
        supersedes: "reused",
        supersedesEndpoint: endpoint,
      }).find((s) => s.role === "fact-supersedes")?.physical,
    ).toBeUndefined();
  });
  it("keeps top-level and pending replay endpoint slots distinct", () => {
    const slots = extractReferenceSlots("factHistory", {
      ...base,
      scopeVersion: 1,
      sourceFactId: "top",
      factId: "f",
      pendingRichEvent: {
        payload: {
          scopeVersion: 1,
          sourceFactId: "pending",
          factId: "f",
          metadata: { storageId: "forged" },
        },
      },
    });
    expect(
      slots
        .filter((s) => s.role === "history-source")
        .map((s) => [s.slot, s.physical]),
    ).toEqual([
      ["sourceFactId", "top"],
      ["pending.sourceFactId", "pending"],
    ]);
    expect(slots.some((s) => s.storageId)).toBe(false);
  });
  it.each([
    { versionHistory: [{ version: 1 }, { version: 1 }] },
    { versionHistory: [{ version: true }] },
  ])("refuses malformed or duplicate version slots %j", (row) => {
    expect(() => extractReferenceSlots("artifacts", row)).toThrow(
      "REFERENCE_DUPLICATE_SLOT",
    );
  });
  it("refuses duplicate stable message identities before effects", () => {
    expect(() =>
      extractReferenceSlots("conversations", {
        messages: [{ id: "one" }, { id: "one" }],
      }),
    ).toThrow("REFERENCE_DUPLICATE_SLOT");
  });
});
describe("primary and combined budget boundaries", () => {
  it("never invents a hook read allowance", () => {
    expect(lifecycleReadAllowance({})).toBe(0);
  });
  it("retains primary reserve/account and encoded write/result caps", () => {
    expect(() => new CaptureBudget(2).reserve(3)).toThrow(
      "FACT_HISTORY_BUDGET_EXCEEDED",
    );
    expect(() => new CaptureBudget(2).account([{}, {}, {}])).toThrow(
      "FACT_HISTORY_BUDGET_EXCEEDED",
    );
    expect(() => new CaptureBudget().write("x".repeat(1024 * 1024))).toThrow(
      "FACT_HISTORY_BUDGET_EXCEEDED",
    );
    expect(() =>
      new CaptureBudget().result("x".repeat(8 * 1024 * 1024)),
    ).toThrow("FACT_HISTORY_BUDGET_EXCEEDED");
  });
  it.each([
    {
      documentsRead: { used: 3 },
      bytesRead: { used: 0 },
      bytesWritten: { used: 0 },
    },
    {
      documentsRead: { used: 1 },
      bytesRead: { used: 12 * 1024 * 1024 + 1 },
      bytesWritten: { used: 0 },
    },
    {
      documentsRead: { used: 1 },
      bytesRead: { used: 0 },
      bytesWritten: { used: 3 * 1024 * 1024 + 1 },
    },
  ])("preserves native primary and byte refusals %j", async (metrics) => {
    await expect(
      new CaptureBudget(2).finish(
        { meta: { getTransactionMetrics: async () => metrics } } as never,
        {},
      ),
    ).rejects.toThrow("FACT_HISTORY_BUDGET_EXCEEDED");
  });
  it("uses actual native remaining bounds before admission", async () => {
    const metrics = {
      bytesRead: { used: 1, remaining: 100 },
      bytesWritten: { used: 0, remaining: 1024 },
      documentsWritten: { remaining: 3 },
    };
    await expect(
      reserveLifecycle(
        { meta: { getTransactionMetrics: async () => metrics } } as never,
        101,
      ),
    ).rejects.toThrow("REFERENCE_NATIVE_BUDGET");
    await expect(
      reserveLifecycle(
        { meta: { getTransactionMetrics: async () => metrics } } as never,
        1,
        1,
        4,
      ),
    ).rejects.toThrow("REFERENCE_NATIVE_BUDGET");
  });
});

import { uniqueReference } from "../../convex-dev/lib/referenceLifecycle";
describe("derived identity uniqueness", () => {
  it("distinguishes absent, exact unique and duplicated identities", () => {
    expect(uniqueReference([])).toBeNull();
    const one = { key: "storage:owned" };
    expect(uniqueReference([one])).toBe(one);
    expect(() => uniqueReference([one, { ...one }])).toThrow(
      /REFERENCE_DUPLICATE_IDENTITY/,
    );
  });
});
