import { jest } from "@jest/globals";
import type { ConvexClient } from "convex/browser";
import { getFunctionName } from "convex/server";
import { ConvexError } from "convex/values";
import { FactsAPI } from "../../src/facts";
import { ResilienceLayer } from "../../src/resilience";
import { enableDeploymentOperator } from "../../src/common/deploymentOperator";
import type { FactRecord } from "../../src/types";

const name = (reference: unknown) =>
  getFunctionName(reference as Parameters<typeof getFunctionName>[0]);
const fact = (index: number) =>
  ({
    _id: `physical-${index}`,
    factId: `fact-${index}`,
    memorySpaceId: "owned-space",
    tenantId: "owned-tenant",
    createdAt: index,
  }) as FactRecord;
function transport(result: unknown = []) {
  const query = jest.fn(async (_reference: unknown, _args: unknown) => result);
  const mutation = jest.fn(async (reference: unknown, _args: unknown): Promise<unknown> =>
    ["facts:deleteFact", "facts:deleteMany"].includes(name(reference).replace(/^cliOperator\//, ""))
      ? { deleted: true, factId: "fact-selected" } : result);
  const client = {
    query,
    mutation,
    action: jest.fn(),
    onUpdate: jest.fn(),
  } as unknown as ConvexClient;
  return {
    client,
    query,
    mutation,
    api: new FactsAPI(client, undefined, undefined, {
      userId: "actor",
      tenantId: "owned-tenant",
    }),
  };
}

describe("public facts use registered scoped handlers while operator paging remains explicit", () => {
  it("returns every public list result beyond1000 without an implicit cap or legacy candidate fallback", async () => {
    const rows = Array.from({ length: 1051 }, (_, index) => fact(index));
    const f = transport(rows);
    await expect(f.api.list({ memorySpaceId: "owned-space" })).resolves.toBe(
      rows,
    );
    expect(f.mutation).toHaveBeenCalledTimes(1);
    expect(name(f.mutation.mock.calls[0]![0])).toBe("facts:list");
    expect(f.mutation.mock.calls[0]![1]).toMatchObject({
      memorySpaceId: "owned-space",
      tenantId: "owned-tenant",
    });
    expect(f.mutation.mock.calls[0]![1]).not.toHaveProperty("paginationOpts");
    expect(
      (f.mutation.mock.calls[0]![1] as { limit?: number }).limit,
    ).toBeUndefined();
  });

  it("forwards validated public windows, zero and epoch selectors to the actual list/search contracts", async () => {
    const f = transport([]);
    await f.api.list({
      memorySpaceId: "owned-space",
      limit: 7,
      offset: 3,
      sortBy: "confidence",
      sortOrder: "asc",
      createdAfter: new Date(0),
      createdBefore: new Date(20),
    });
    expect(f.mutation.mock.calls[0]![1]).toMatchObject({
      limit: 7,
      offset: 3,
      sortBy: "confidence",
      sortOrder: "asc",
      createdAfter: 0,
      createdBefore: 20,
    });
    await f.api.search("owned-space", "secret", {
      limit: 0,
      offset: 4,
      tags: ["owned"],
    });
    expect(name(f.mutation.mock.calls[1]![0])).toBe("facts:search");
    expect(f.mutation.mock.calls[1]![1]).toMatchObject({
      query: "secret",
      limit: 0,
      offset: 4,
      tags: ["owned"],
      tenantId: "owned-tenant",
    });
    await f.api.search("owned-space", "secret");
    expect(f.mutation.mock.calls[2]![1]).toMatchObject({ limit: 20 });
  });

  it.each(["FORBIDDEN", "native resource limit", "transport unavailable"])(
    "propagates %s without public/operator fallback",
    async (message) => {
      const failure = new Error(message);
      const f = transport();
      f.mutation.mockRejectedValue(failure);
      await expect(f.api.list({ memorySpaceId: "owned-space" })).rejects.toBe(
        failure,
      );
      await expect(f.api.search("owned-space", "secret")).rejects.toBe(failure);
      expect(f.mutation.mock.calls.map((call) => name(call[0]))).toEqual([
        "facts:list",
        "facts:search",
      ]);
      expect(f.query).not.toHaveBeenCalled();
    },
  );

  it("keeps exact operator paging and retained-history deletion arguments", async () => {
    const f = transport();
    f.query
      .mockResolvedValueOnce({
        page: [fact(1)],
        isDone: false,
        continueCursor: "next",
      })
      .mockResolvedValueOnce({
        page: [fact(2)],
        isDone: true,
        continueCursor: "end",
      });
    enableDeploymentOperator(f.client);
    await expect(
      f.api.list({
        memorySpaceId: "owned-space",
        sortBy: "createdAt",
        sortOrder: "asc",
      }),
    ).resolves.toEqual([fact(1), fact(2)]);
    expect(f.query.mock.calls.map((call) => name(call[0]))).toEqual([
      "cliOperator/facts:candidatePage",
      "cliOperator/facts:candidatePage",
    ]);
    expect(f.query.mock.calls[1]![1]).toMatchObject({
      paginationOpts: { cursor: "next", endCursor: null, numItems: 128 },
      tenantId: "owned-tenant",
    });
    await f.api.delete("owned-space", "fact-selected", {
      operationId: "retained-intent",
    });
    expect(name(f.mutation.mock.calls[0]![0])).toBe(
      "cliOperator/facts:deleteFact",
    );
    expect(f.mutation.mock.calls[0]![1]).toEqual({
      memorySpaceId: "owned-space",
      factId: "fact-selected",
      tenantId: "owned-tenant",
      operationId: "retained-intent",
    });
  });

  it("sends only registered public delete arguments and rejects conflicting tenant selectors before dispatch", async () => {
    const f = transport();
    await expect(
      f.api.delete("owned-space", "fact-selected", {
        operationId: "caller-label",
      }),
    ).resolves.toEqual({ deleted: true, factId: "fact-selected" });
    expect(name(f.mutation.mock.calls[0]![0])).toBe("facts:deleteFact");
    expect(f.mutation.mock.calls[0]![1]).toEqual({
      memorySpaceId: "owned-space",
      factId: "fact-selected",
    });
    await expect(
      f.api.delete("owned-space", "fact-selected", {
        tenantId: "foreign-tenant",
      }),
    ).rejects.toThrow("FACT_HISTORY_SCOPE_MISMATCH");
    await expect(
      f.api.list({ memorySpaceId: "owned-space", tenantId: "foreign-tenant" }),
    ).rejects.toThrow("TENANT_SCOPE_MISMATCH");
    await expect(
      f.api.search("owned-space", "secret", { tenantId: "foreign-tenant" }),
    ).rejects.toThrow("TENANT_SCOPE_MISMATCH");
    expect(f.mutation).toHaveBeenCalledTimes(1);
    expect(f.query).not.toHaveBeenCalled();
  });

  it("dispatches a public delete once with enabled resilience and preserves an unknown committed outcome", async () => {
    const f = transport();
    const unknown = new Error("network outcome unknown");
    let retired = false;
    f.mutation
      .mockImplementationOnce(async () => {
        retired = true;
        throw unknown;
      })
      .mockRejectedValue(new ConvexError({ code: "FORBIDDEN" }));
    const retry = jest.fn();
    const resilience = new ResilienceLayer({
      enabled: true,
      retry: { maxRetries: 1, baseDelayMs: 1, maxDelayMs: 1, jitter: false },
      onRetry: retry,
    });
    const api = new FactsAPI(f.client, undefined, resilience, {
      userId: "actor",
      tenantId: "owned-tenant",
    });
    try {
      await expect(api.delete("owned-space", "fact-selected")).rejects.toBe(
        unknown,
      );
      expect(retired).toBe(true);
      expect(f.mutation).toHaveBeenCalledTimes(1);
      expect(name(f.mutation.mock.calls[0]![0])).toBe("facts:deleteFact");
      expect(f.mutation.mock.calls[0]![1]).toEqual({
        memorySpaceId: "owned-space",
        factId: "fact-selected",
      });
      expect(f.query).not.toHaveBeenCalled();
      expect(retry).not.toHaveBeenCalled();
    } finally {
      await resilience.shutdown(1000);
    }
  });

  it("preserves a public refusal with enabled resilience without retry or fallback", async () => {
    const f = transport();
    f.mutation.mockRejectedValue(
      new ConvexError({ code: "FORBIDDEN", outcome: "not_dispatched" }),
    );
    const resilience = new ResilienceLayer({
      enabled: true,
      retry: { maxRetries: 1, baseDelayMs: 1, maxDelayMs: 1, jitter: false },
    });
    const api = new FactsAPI(f.client, undefined, resilience, {
      userId: "actor",
      tenantId: "owned-tenant",
    });
    try {
      await expect(api.delete("owned-space", "fact-selected")).rejects.toThrow(
        '{"code":"FORBIDDEN","outcome":"not_dispatched"}',
      );
      expect(f.mutation).toHaveBeenCalledTimes(1);
      expect(name(f.mutation.mock.calls[0]![0])).toBe("facts:deleteFact");
      expect(f.query).not.toHaveBeenCalled();
    } finally {
      await resilience.shutdown(1000);
    }
  });

  it("retains explicit operator retries with the same retained-history intent", async () => {
    const f = transport();
    enableDeploymentOperator(f.client);
    f.mutation.mockRejectedValueOnce(new Error("network outcome unknown"));
    const resilience = new ResilienceLayer({
      enabled: true,
      retry: { maxRetries: 1, baseDelayMs: 1, maxDelayMs: 1, jitter: false },
    });
    const api = new FactsAPI(f.client, undefined, resilience, {
      userId: "actor",
      tenantId: "owned-tenant",
    });
    try {
      await expect(
        api.delete("owned-space", "fact-selected", {
          operationId: "retained-intent",
        }),
      ).resolves.toEqual({ deleted: true, factId: "fact-selected" });
      expect(f.mutation).toHaveBeenCalledTimes(2);
      for (const [reference, args] of f.mutation.mock.calls) {
        expect(name(reference)).toBe("cliOperator/facts:deleteFact");
        expect(args).toEqual({
          memorySpaceId: "owned-space",
          factId: "fact-selected",
          tenantId: "owned-tenant",
          operationId: "retained-intent",
        });
      }
      expect(f.query).not.toHaveBeenCalled();
    } finally {
      await resilience.shutdown(1000);
    }
  });
  it("selects the public subject handler without unsupported tenant fields and preserves operator tenant selection", async () => {
    const f = transport([fact(1)]);
    await expect(
      f.api.queryBySubject({
        memorySpaceId: "owned-space",
        subject: "actor",
        limit: 3,
        createdAfter: new Date(0),
      }),
    ).resolves.toEqual([fact(1)]);
    expect(name(f.mutation.mock.calls[0]![0])).toBe("facts:queryBySubject");
    expect(f.mutation.mock.calls[0]![1]).toMatchObject({
      memorySpaceId: "owned-space",
      subject: "actor",
      limit: 3,
      createdAfter: 0,
    });
    expect(f.mutation.mock.calls[0]![1]).not.toHaveProperty("tenantId");
    enableDeploymentOperator(f.client);
    await f.api.queryBySubject({
      memorySpaceId: "owned-space",
      subject: "actor",
    });
    expect(name(f.query.mock.calls[0]![0])).toBe(
      "cliOperator/facts:queryBySubject",
    );
    expect(f.query.mock.calls[0]![1]).toMatchObject({
      tenantId: "owned-tenant",
      memorySpaceId: "owned-space",
      subject: "actor",
    });
  });

  it("uses atomic public bulk deletion without a missing candidate page or unsupported selection loss", async () => {
    const f = transport();
    f.mutation.mockResolvedValue({
      deleted: 2,
      memorySpaceId: "owned-space",
    } as never);
    await expect(
      f.api.deleteMany({
        memorySpaceId: "owned-space",
        factType: "custom",
        userId: "actor",
      }),
    ).resolves.toEqual({ deleted: 2, memorySpaceId: "owned-space" });
    expect(name(f.mutation.mock.calls[0]![0])).toBe("facts:deleteMany");
    expect(f.mutation.mock.calls[0]![1]).toEqual({
      memorySpaceId: "owned-space",
      factType: "custom",
      userId: "actor",
    });
    expect(f.query).not.toHaveBeenCalled();
    await expect(
      f.api.deleteMany({
        memorySpaceId: "owned-space",
        includeSuperseded: false,
      }),
    ).rejects.toThrow("DOMAIN_PUBLIC_SELECTION_UNSUPPORTED");
    await expect(
      f.api.deleteMany({ memorySpaceId: "owned-space", tenantId: "foreign" }),
    ).rejects.toThrow("TENANT_SCOPE_MISMATCH");
    const controller = new AbortController();
    controller.abort();
    await expect(
      f.api.deleteMany({
        memorySpaceId: "owned-space",
        signal: controller.signal,
      }),
    ).rejects.toThrow("DOMAIN_CANCELLED");
    await expect(
      f.api.deleteMany({ memorySpaceId: "owned-space", deadlineMs: 0 }),
    ).rejects.toThrow("DOMAIN_INVALID_DEADLINE");
    expect(f.mutation).toHaveBeenCalledTimes(1);
  });
});
