import { jest } from "@jest/globals";
import { getFunctionName } from "convex/server";
import { enableDeploymentOperator } from "../../src/common/deploymentOperator";
import type { MemorySpacesAPI as MemorySpacesType } from "../../src/memorySpaces";






import { validateUserCountResult } from "../../src/users/validators";


// Production Cortex/MemoryAPI construction with a controlled transport factory.
// Native tests independently use the real Convex client; no socket is opened here.
class ControlledClient {
  query = async () => 0;
  mutation = async () => ({});
  close = async () => undefined;
}
jest.unstable_mockModule("convex/browser", () => ({ConvexClient:ControlledClient, ConvexHttpClient:ControlledClient}));
const {MemorySpacesAPI} = await import("../../src/memorySpaces");
const {UsersAPI} = await import("../../src/users");
const {VectorAPI} = await import("../../src/vector");
const {ConversationsAPI} = await import("../../src/conversations");
const {FactsAPI} = await import("../../src/facts");
const {MemoryAPI} = await import("../../src/memory");
const {Cortex,createAuthContext} = await import("../../src/index");

const scopeCases = ["tenant-A", "tenant-B", undefined];
const space = { memorySpaceId: "shared", name: "same", type: "team", status: "active", participants: [], metadata: {}, createdAt: 1, updatedAt: 2 };
function fixture(tenantId?: string) {
  const calls: Array<{name: string; args: any}> = [];
  let profile: any = { id: "same-user", tenantId, data: {}, version: 2, createdAt: 1, updatedAt: 2 };
  const invoke = async (ref: any, args: any) => {
    const functionName = getFunctionName(ref); calls.push({name: functionName, args});
    const name = functionName.replace(/^cliOperator\//, "");
    if (name.endsWith(":count")) return 1001;
    if (name === "immutable:get") return profile;
    if (name === "immutable:purge") { profile = null; return {deleted:true}; }
    if (name === "immutable:store") { profile = {...profile, ...args}; return profile; }
    if (name === "immutable:list") return {entries: [profile], total:1, hasMore:false};
    if (name === "immutable:getHistory") return [{version:1,data:{old:true},timestamp:1}];
    if (name === "memorySpaces:list") return { spaces: [{...space, tenantId}], total:1, hasMore:false, offset:0 };
    if (["memorySpaces:search", "memorySpaces:findByParticipant"].includes(name)) return [{...space,tenantId}];
    return {...space,tenantId};
  };
  const client: any = {query:invoke, mutation:invoke};
  const auth = tenantId === undefined ? undefined : createAuthContext({userId:"actor",tenantId});
  return {client, auth, calls};
}
const operations: Record<string, (api: MemorySpacesType) => Promise<unknown>> = {
  register: api => api.register({memorySpaceId:"shared",type:"team"}), get: api => api.get("shared"),
  list: api => api.list(), count: api => api.count(), update: api => api.update("shared",{name:"updated"}),
  addParticipant: api => api.addParticipant("shared",{id:"p",type:"tool",joinedAt:3}),
  removeParticipant: api => api.removeParticipant("shared","p"), archive: api => api.archive("shared",{reason:"reason"}),
  reactivate: api => api.reactivate("shared"), getStats: api => api.getStats("shared",{includeParticipants:true}),
  findByParticipant: api => api.findByParticipant("p"), search: api => api.search("shared"),
  updateParticipants: api => api.updateParticipants("shared",{add:[{id:"p",type:"tool",joinedAt:3}]}),
};
for (const tenant of scopeCases) describe(`SDK exact ${tenant ?? "tenantless"} scope`,()=>{
  for (const [name,invoke] of Object.entries(operations)) it(`${name} scopes every transport call`,async()=>{
    const f=fixture(tenant); await invoke(new MemorySpacesAPI(f.client,undefined,undefined,f.auth));
    expect(f.calls.length).toBeGreaterThan(0); for(const call of f.calls) expect(call.args.tenantId).toBe(tenant);
  });
  it("delete scopes every explicit administrative erasure request and verifies the root outcome", async () => {
    const { ERASURE_OPERATIONS } = await import("../../src/users/erasure");
    const f = fixture(tenant), requests: Array<Record<string, any>> = [];
    const domain = { kind: "space" as const, memorySpaceId: "shared", tenantId: tenant };
    const envelope = { protocolVersion: 1 as const, domain, observationTime: 1 };
    const root = { table: "memorySpaces", id: "scoped-root", action: "root", fingerprint: "1".repeat(64), dependencies: [], retainedVersions: 0, messages: 0, serializedBytes: 128, storageIds: [] };
    let live = true;
    const page = async (request: Record<string, any>) => {
      requests.push(request);
      return { ...envelope, table: request.table, page: live && request.table === "memorySpaces" ? [root] : [], isDone: true, continueCursor: "done" };
    };
    const transport = {
      kind: "cortex-erasure-v1" as const, protocolVersion: 1 as const, operations: ERASURE_OPERATIONS, close: () => undefined,
      discoverPage: page, verifyPage: page,
      checkRecord: async (request: Record<string, any>) => { requests.push(request); return { ...envelope, record: root }; },
      checkBinaryReferences: async (request: Record<string, any>) => { requests.push(request); return { ...envelope, blobs: [] }; },
      getReceiptPage: async () => ({ ...envelope, page: [], isDone: true, continueCursor: "done" }),
      eraseRecord: async (request: Record<string, any>) => {
        requests.push(request); live = false;
        return { ...envelope, operationId: request.operationId, itemKey: request.itemKey, table: root.table, id: root.id,
          state: "committed", deleted: 1, detached: 0, retainedVersions: 0, messages: 0, blobs: [], graphJobs: [] };
      },
      purgeExpiredReceiptsPage: async () => ({ protocolVersion: 1 as const, deleted: 0, isDone: true, continueCursor: "done" }),
    };
    const result = await new MemorySpacesAPI(f.client, undefined, undefined, f.auth).delete("shared", {
      cascade: true, reason: "owned fixture", confirmId: "shared", erasureTransport: transport as unknown as import("../../src/users/erasure").ErasureTransport,
    });
    if (!result.erasure) throw new Error("explicit erasure receipt missing");
    expect(result.deleted).toBe(true); expect(result.erasure.complete).toBe(true); expect(result.erasure.totalDeleted).toBe(1);
    expect(f.calls).toHaveLength(0); expect(requests.length).toBeGreaterThan(0);
    for (const request of requests) expect(request.domain).toEqual(domain);
  });
  for(const name of ["get","update","list","getHistory","count"] as const) it(`profile ${name} scopes actual transport`,async()=>{
    const f=fixture(tenant);const api=new UsersAPI(f.client,undefined,undefined,f.auth);
    await (name==="update"?api.update("same-user",{new:true}):name==="list"?api.list():name==="count"?api.count():api[name]("same-user"));
    for(const call of f.calls) expect(call.args.tenantId).toBe(tenant);
  });
  it("profile dry run has no mutation; real deletion is explicitly verified profile-only",async()=>{
    const f=fixture(tenant);const api=new UsersAPI(f.client,undefined,undefined,f.auth);
    const dry=await api.delete("same-user",{dryRun:true});expect(f.calls).toHaveLength(0);expect(dry.totalDeleted).toBe(0);expect(dry.verification).toMatchObject({scope:"user-profile",complete:false});
    const result=await api.delete("same-user");expect(result.verification).toMatchObject({scope:"user-profile",complete:true});expect(f.calls.map(c=>c.name)).toEqual(["immutable:purge","immutable:get"]);
  });
  it("explicit operator count callers and MemoryAPI internal vector propagate scope and participant",async()=>{
    const f=fixture(tenant);const v=new VectorAPI(f.client,undefined,undefined,f.auth);
    enableDeploymentOperator(f.client);
    await v.count({memorySpaceId:"shared",participantId:"p",sourceType:"system",userId:"u"});
    await new ConversationsAPI(f.client,undefined,undefined,f.auth).count({memorySpaceId:"shared",type:"user-agent",userId:"u"});
    await new FactsAPI(f.client,undefined,undefined,f.auth).count({memorySpaceId:"shared",tags:["t"],includeSuperseded:true});
    const m=new MemoryAPI(f.client,undefined,undefined,{authContext:f.auth} as any);await m.count({memorySpaceId:"shared",participantId:"p"});
    for(const call of f.calls) expect(call.args.tenantId).toBe(tenant);expect(f.calls[0].args.participantId).toBe("p");expect(f.calls[3].args.participantId).toBe("p");
  });
  for (const operator of [false, true]) it(`production ${operator ? "operator" : "public"} Cortex.vector and Cortex.memory use the intended scope contract`,async()=>{
    const cortex=new Cortex({convexUrl:"http://127.0.0.1:45799",auth:createAuthContext({userId:"actor",...(tenant===undefined?{}:{tenantId:tenant})}),graphEnabled:false,resilience:{enabled:false},convexLogger:false}, operator ? {deploymentOperator:true} : undefined);
    const client=(cortex as any).client;const query=jest.spyOn(client,"query").mockResolvedValue(0);
    try {
      await cortex.vector.count({memorySpaceId:"shared"});await cortex.memory.count({memorySpaceId:"shared"});
      expect(query).toHaveBeenCalledTimes(2);
      for(const call of query.mock.calls) {
        // The spy observes the logical SDK reference before operator routing.
        expect(getFunctionName(call[0] as any)).toBe("memories:count");
        if (operator) expect((call[1] as any).tenantId).toBe(tenant);
        else expect(call[1]).toEqual({memorySpaceId:"shared"});
      }
      if (!operator) {
        await expect(cortex.vector.count({memorySpaceId:"shared",participantId:"p"})).rejects.toMatchObject({code:"UNSUPPORTED_PUBLIC_SELECTOR"});
        if (tenant) await expect(cortex.memory.count({memorySpaceId:"shared",tenantId:"foreign"})).rejects.toThrow();
        expect(query).toHaveBeenCalledTimes(2);
      }
    }finally{await cortex.shutdown();}
  });
});
for(const selected of ["", " ", null, false, 7]) it(`rejects malformed tenant ${JSON.stringify(selected)} before transport`,async()=>{
  const f=fixture();const api=new MemorySpacesAPI(f.client);await expect(api.list({tenantId:selected} as any)).rejects.toThrow();
  await expect(new UsersAPI(f.client).count({tenantId:selected} as any)).rejects.toThrow();
  await expect(new VectorAPI(f.client).count({memorySpaceId:"shared",tenantId:selected} as any)).rejects.toThrow();
  await expect(new ConversationsAPI(f.client).count({tenantId:selected} as any)).rejects.toThrow();
  await expect(new FactsAPI(f.client).count({memorySpaceId:"shared",tenantId:selected} as any)).rejects.toThrow();expect(f.calls).toHaveLength(0);
});
it("retained explicit scope selects without context and refuses conflict in all selected APIs",async()=>{
 for(const tenant of [undefined,"tenant-A"]){const f=fixture(tenant);const expected=tenant?"tenant-B":"tenant-B";
  enableDeploymentOperator(f.client);
  const invokes=[()=>new MemorySpacesAPI(f.client,undefined,undefined,f.auth).register({memorySpaceId:"shared",type:"team",tenantId:expected}),()=>new MemorySpacesAPI(f.client,undefined,undefined,f.auth).list({tenantId:expected}),()=>new UsersAPI(f.client,undefined,undefined,f.auth).list({tenantId:expected}),()=>new UsersAPI(f.client,undefined,undefined,f.auth).count({tenantId:expected}),()=>new VectorAPI(f.client,undefined,undefined,f.auth).count({memorySpaceId:"shared",tenantId:expected}),()=>new ConversationsAPI(f.client,undefined,undefined,f.auth).count({tenantId:expected}),()=>new FactsAPI(f.client,undefined,undefined,f.auth).count({memorySpaceId:"shared",tenantId:expected})];
  for(const invoke of invokes){if(tenant) await expect(invoke()).rejects.toThrow();else await invoke();}if(tenant)expect(f.calls).toHaveLength(0);else for(const call of f.calls) expect(call.args.tenantId).toBe(expected);
 }
});
for(const filters of [null,[],new Date(),{limit:undefined},{sortBy:"createdAt"},{type:"audit"},{userId:"u"},{filters:{}},{createdAfter:-1},{createdAfter:NaN},{createdAfter:Infinity},{createdAfter:true},{createdAfter:2,createdBefore:1},{updatedAfter:0,updatedBefore:0}]) it(`count refuses unsupported/malformed ${Object.keys(filters ?? {}).join(',')}`,async()=>{
 const f=fixture();await expect(new UsersAPI(f.client).count(filters as any)).rejects.toThrow();expect(f.calls).toHaveLength(0);
});
it("profile count retains zero/fractional strict cutoffs and flat fixed type",async()=>{
 const f=fixture();expect(await new UsersAPI(f.client).count({createdAfter:0,createdBefore:0.5,updatedAfter:1.25,updatedBefore:2})).toBe(1001);expect(f.calls[0]).toEqual({name:"immutable:count",args:{type:"user",tenantId:undefined,createdAfter:0,createdBefore:0.5,updatedAfter:1.25,updatedBefore:2}});
});
for(const value of [-1,1.5,NaN,Infinity,"3",true,null,{}]) it(`count rejects malformed response ${String(value)}`,()=>expect(()=>validateUserCountResult(value)).toThrow());
it("count error propagates without fallback or mutation",async()=>{const f=fixture();f.client.query=async()=>{throw new Error("native-budget");};await expect(new UsersAPI(f.client).count()).rejects.toThrow("native-budget");expect(f.calls).toHaveLength(0);});
it("profile get defensively rejects foreign and tenantless rows from a scoped transport",async()=>{const f=fixture("tenant-A");f.client.query=async()=>({id:"same-user",data:{},tenantId:undefined});expect(await new UsersAPI(f.client,undefined,undefined,f.auth).get("same-user")).toBeNull();});
