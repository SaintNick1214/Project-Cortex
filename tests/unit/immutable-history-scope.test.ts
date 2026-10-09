import { jest } from "@jest/globals";
import type { ConvexClient } from "convex/browser";
import { ImmutableAPI } from "../../src/immutable";

it("history queries keep equal logical IDs in their authenticated tenant, including unscoped data", async () => {
  const histories = new Map([
    ["tenant-A", [{ type: "document", id: "same-id", version: 1, data: { owner: "A" } }]],
    ["tenant-B", [{ type: "document", id: "same-id", version: 1, data: { owner: "B" } }]],
    ["unscoped", [{ type: "document", id: "same-id", version: 1, data: { owner: "unscoped" } }]],
  ]);
  const before = structuredClone(histories);
  const mutation = jest.fn(async (_reference: unknown, args: { tenantId?: string; type: string; id: string }) =>
    histories.get(args.tenantId ?? "unscoped")!.filter(row => row.id === args.id && row.type === args.type));
  const query = jest.fn();
  const client = { mutation, query } as unknown as ConvexClient;
  const a = new ImmutableAPI(client, undefined, undefined, { userId: "actor-A", tenantId: "tenant-A" });
  const b = new ImmutableAPI(client, undefined, undefined, { userId: "actor-B", tenantId: "tenant-B" });
  const unscoped = new ImmutableAPI(client);
  expect(await a.getHistory("document", "same-id")).toEqual(histories.get("tenant-A"));
  expect(await b.getHistory("document", "same-id")).toEqual(histories.get("tenant-B"));
  expect(await unscoped.getHistory("document", "same-id")).toEqual(histories.get("unscoped"));
  expect(mutation.mock.calls.map(([, args]) => args.tenantId)).toEqual(["tenant-A", "tenant-B", undefined]);
  expect(query).not.toHaveBeenCalled();
  expect(histories).toEqual(before);
});
