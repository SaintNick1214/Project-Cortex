import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";
import { makeFunctionReference } from "convex/server";
import { convexToJson, type Value } from "convex/values";
import type { ConvexClient } from "convex/browser";
import type { Cortex } from "@cortexmemory/sdk";
import type { CLIConfig } from "../../types.js";

const instances: Array<{transport: ConvexClient; wsQuery: ReturnType<typeof jest.fn>; wsMutation: ReturnType<typeof jest.fn>; wsAction: ReturnType<typeof jest.fn>; wsAdmin: ReturnType<typeof jest.fn>; close: ReturnType<typeof jest.fn>}> = [];
const queryRef = makeFunctionReference<"query">("memorySpaces:list");
const mutationRef = makeFunctionReference<"mutation">("memorySpaces:register");
const actionRef = makeFunctionReference<"action">("qa:action");
// This fake models the original dangerous reconnect: a keyed WS rejection can
// leave its public read callable anonymously. HTTP tests use the real client.
jest.unstable_mockModule("@cortexmemory/sdk", () => ({ createAuthContext: (value: unknown) => value,
  Cortex: jest.fn((_config: unknown, runtime?: {initializeTransport?: (client: ConvexClient) => undefined}) => {
    const wsQuery = jest.fn(async () => ({spaces: []}));
    const wsMutation = jest.fn(async () => "anonymous-write");
    const wsAction = jest.fn(async () => "anonymous-action");
    const wsAdmin = jest.fn();
    const close = jest.fn(async () => {});
    const transport = {query: wsQuery, mutation: wsMutation, action: wsAction, setAdminAuth: wsAdmin, close} as unknown as ConvexClient;
    instances.push({transport, wsQuery, wsMutation, wsAction, wsAdmin, close});
    runtime?.initializeTransport?.(transport);
    return {
      memorySpaces: {list: (args: {limit: number}) => transport.query(queryRef,args)},
      getClient: () => transport,
      shutdown: async () => { await transport.close(); }, close: () => { void transport.close(); },
    };
  }),
}));
const {createClient, closeClient, withClient} = await import("../client.js");
const config: CLIConfig = {deployments: {owned: {url: "http://127.0.0.1:43991",key: "selected-private-key"}},default: "owned",format: "json",confirmDangerous: true};
let fetchMock: jest.SpiedFunction<typeof fetch>;
const success = (value: Value) => new Response(JSON.stringify({status: "success",value: convexToJson(value),logLines: []}),{status: 200});
beforeEach(async () => {
  await closeClient(); instances.length = 0;
  fetchMock = jest.spyOn(globalThis,"fetch").mockImplementation(async () => success({spaces: []}));
});
afterEach(async () => { await closeClient(); fetchMock.mockRestore(); });
describe("keyed CLI official HTTP transport", () => {
  it("rejects invalid admin credentials before a public anonymous preflight can admit publisher callbacks",async () => {
    fetchMock.mockResolvedValue(new Response("BadAdminKey",{status: 401}));
    const publisher = {open: jest.fn(),write: jest.fn(),close: jest.fn()};
    const callback = jest.fn(async () => {publisher.open();publisher.write();publisher.close();return "unauthorized";});
    await expect(withClient(config,{},callback)).rejects.toThrow("No command operation was started");
    expect(callback).not.toHaveBeenCalled();
    for(const call of Object.values(publisher)) expect(call).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][1]?.headers).toEqual(expect.objectContaining({Authorization: "Convex selected-private-key"}));
    expect(instances[0].wsQuery).not.toHaveBeenCalled();
    expect(instances[0].wsAdmin).not.toHaveBeenCalled();
    expect(instances[0].close).toHaveBeenCalledTimes(1);
  });
  it("retains correct-key operation-owned callback result without identity reuse",async () => {
    const callback = jest.fn(async (client: Cortex) => {expect(client.getClient()).toBe(instances[0].transport);return "completed";});
    expect(await withClient(config,{},callback)).toBe("completed");
    expect(callback).toHaveBeenCalledTimes(1); expect(instances).toHaveLength(1);
    expect(instances[0].close).toHaveBeenCalledTimes(1);
    const fresh = await createClient(config,{}); expect(fresh.getClient()).toBe(instances[1].transport); expect(instances).toHaveLength(2);
    await closeClient(); expect(instances[1].close).toHaveBeenCalledTimes(1);
  });
  it.each([
    ["query", "memories:domainPage", "cliOperator/memories:domainPage"],
    ["mutation", "facts:deleteMany", "cliOperator/facts:deleteMany"],
    ["action", "facts:semanticSearch", "cliOperator/facts:semanticSearch"],
    ["query", "immutable:get", "cliOperator/immutable:get"],
    ["query", "factHistory:getOperationReceipt", "cliOperator/factHistory:getOperationReceipt"],
    ["query", "graphSync:getGraphJob", "cliOperator/graphSync:getGraphJob"],
    ["query", "referenceMaintenance:status", "referenceMaintenance:status"],
    ["query", "runtimeAuth:status", "runtimeAuth:status"],
  ] as const)("routes keyed %s %s to the selected internal operator contract", async (kind, name, expected) => {
    const transport = (await createClient(config,{})).getClient();
    if (kind === "query") await transport.query(makeFunctionReference<"query">(name), { tenantId: "selected-tenant" });
    else if (kind === "mutation") await transport.mutation(makeFunctionReference<"mutation">(name), { tenantId: "selected-tenant" });
    else await transport.action(makeFunctionReference<"action">(name), { tenantId: "selected-tenant" });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${config.deployments.owned.url}/api/function`);
    expect(JSON.parse(init?.body as string)).toMatchObject({path: expected, args: {tenantId: "selected-tenant"}});
    expect(init?.headers).toEqual(expect.objectContaining({Authorization: "Convex selected-private-key"}));
    expect(instances[0].wsQuery).not.toHaveBeenCalled();
    expect(instances[0].wsMutation).not.toHaveBeenCalled();
    expect(instances[0].wsAction).not.toHaveBeenCalled();
  });
  it("leaves keyless public access on its original transport",async () => {
    const keyless = {...config,deployments: {owned: {url: config.deployments.owned.url}}};
    expect(await withClient(keyless,{},async () => "public")).toBe("public");
    expect(fetchMock).not.toHaveBeenCalled();
    expect(instances[0].wsQuery).toHaveBeenCalledWith(queryRef,{limit: 1});
    expect(instances[0].close).toHaveBeenCalledTimes(1);
  });
  it.each(["query","mutation","action"] as const)("later %s rejection retains admin header and never retries anonymously",async kind => {
    fetchMock.mockResolvedValueOnce(success({spaces: []}));
    fetchMock.mockResolvedValueOnce(new Response("revoked selected-private-key",{status: 401}));
    const callback = jest.fn(async (client: Cortex) => {
      const transport = client.getClient();
      if(kind === "query") return transport.query(queryRef,{});
      if(kind === "mutation") return transport.mutation(mutationRef,{});
      return transport.action(actionRef,{});
    });
    const pending = withClient(config,{},callback);
    await expect(pending).rejects.toThrow("revoked ***");
    expect(callback).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    for(const [,init] of fetchMock.mock.calls) expect(init?.headers).toEqual(expect.objectContaining({Authorization: "Convex selected-private-key"}));
    expect(fetchMock.mock.calls[1][0]).toBe(`${config.deployments.owned.url}/api/function`);
    expect(instances[0].wsQuery).not.toHaveBeenCalled();expect(instances[0].wsMutation).not.toHaveBeenCalled();expect(instances[0].wsAction).not.toHaveBeenCalled();
    expect(instances[0].close).toHaveBeenCalledTimes(1);
  });
  it.each(["query","mutation","action"] as const)("official %s codec preserves native request/result values",async kind => {
    const value = {integer: 9223372036854775807n,bytes: new Uint8Array([0,255,128,1]).buffer,nan: NaN,infinity: Infinity,negativeInfinity: -Infinity,negativeZero: -0,nested: [null,false,"é🌱\u0000"]};
    fetchMock.mockResolvedValue(success(value));
    const transport = (await createClient(config,{})).getClient();
    const result = kind === "query" ? await transport.query(queryRef,value) : kind === "mutation" ? await transport.mutation(mutationRef,value) : await transport.action(actionRef,value);
    expect(convexToJson(result)).toEqual(convexToJson(value));
    const body = JSON.parse(fetchMock.mock.calls[0][1]?.body as string);
    expect(body.format).toBe("convex_encoded_json"); expect(body.args).toEqual(convexToJson(value));
    expect(fetchMock.mock.calls[0][1]?.headers).toEqual(expect.objectContaining({Authorization: "Convex selected-private-key"}));
  });
  it("aborts active HTTP and joins original close without replay",async () => {
    let active!: AbortSignal;
    fetchMock.mockImplementation((_input,init) => new Promise((_resolve,reject) => {
      active = init!.signal!;
      active.addEventListener("abort",() => reject(new DOMException("Closed","AbortError")),{once: true});
    }));
    const transport = (await createClient(config,{})).getClient();
    const pending = transport.query(queryRef,{});
    const rejected = expect(pending).rejects.toThrow("Closed");
    expect(active.aborted).toBe(false);
    await closeClient(); await rejected;
    expect(active.aborted).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(instances[0].close).toHaveBeenCalledTimes(1);
  });

});
