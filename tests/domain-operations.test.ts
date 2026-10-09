/** Task22 native public reads on an explicitly owned disposable target. */
import { nativeAdmin, nativeTarget, proofPrefix } from "./helpers/native-ci";
import { jsonToConvex } from "convex/values";
import { Cortex } from "./helpers/deployment-operator";
const prefix = proofPrefix("task22-ci");
const space = prefix + "-same-space", large = prefix + "-large";
beforeAll(async () => {
 const admin = nativeAdmin();
 const seed = (kind:string, tenantId:string|undefined, memorySpaceId:string, suffix:string, count=1, start=0, embedding=false) => admin.function("task22Native:seed",undefined,{kind,tenantId,memorySpaceId,prefix:(kind==="facts"?"fact-":kind==="memories"?"mem-":"conv-")+prefix+suffix,start,count,embedding,special:kind==="facts"});
 for (const tenantId of ["A","B",undefined]) {
  await seed("memories",tenantId,space,"-mem-same-");
  await seed("facts",tenantId,space,"-fact-same-");
  await seed("conversations",tenantId,space,"-conv-same-");
  if (tenantId === "A") await seed("conversations",tenantId,space,"-conv-same-");
 }
 for (let start=0;start<1202;start+=16) await seed("memories","A",large,"-foreign-",Math.min(16,1202-start),start,true);
 await seed("memories","B",large,"-selected-",6,0,true);
}, 120000);
it.each(["A", "B", undefined])("native exact scope/full fact codec/zero windows and ambiguity: %s", async tenantId => {
  const c = new Cortex({convexUrl: nativeTarget().url, convexLogger: false, auth: {userId: "actor", tenantId}, resilience: {enabled: false}});
  try {
    const memory = await c.vector.get(space, "mem-" + prefix + "-mem-same-0");
    expect(memory?.tenantId).toBe(tenantId);
    expect(await c.vector.list({memorySpaceId: space, limit: 0})).toEqual([]);
    expect(await c.vector.search(space, "empty", {limit: 0})).toEqual([]);
    const fact = await c.facts.get(space, "fact-" + prefix + "-fact-same-0");
    expect(fact?.tenantId).toBe(tenantId);
    const exported = await c.facts.export({memorySpaceId: space, format: "json"});
    const rows = JSON.parse(exported.data);
    expect(rows).toHaveLength(1);
    expect(jsonToConvex(rows[0].metadata.integer)).toBe(9223372036854775807n);
    expect(new Uint8Array(jsonToConvex(rows[0].metadata.bytes) as ArrayBuffer)).toEqual(new Uint8Array([0, 255]));
    if (tenantId === "A") await expect(c.conversations.get("conv-" + prefix + "-conv-same-0")).rejects.toThrow("DOMAIN_SCOPE_AMBIGUOUS");
    else {
      expect((await c.conversations.get("conv-" + prefix + "-conv-same-0"))?.messages).toHaveLength(2);
      expect((await c.conversations.get("conv-" + prefix + "-conv-same-0", {messageLimit: 0}))?.messages).toEqual([]);
    }
    const other = tenantId === "A" ? "B" : "A";
    if (tenantId !== undefined) await expect(c.vector.get(space, "mem-" + prefix + "-mem-same-0", {tenantId: other})).rejects.toThrow("TENANT_SCOPE_MISMATCH");
  } finally { await c.shutdown(); }
});
it("native composite search fills a scoped filtered window beyond1201 foreign candidates", async () => {
  const c = new Cortex({convexUrl: nativeTarget().url, convexLogger: false, auth: {userId: "actor", tenantId: "B"}, resilience: {enabled: false}});
  try {
    const embedding = Array.from({length: 1536}, (_, i) => i === 0 ? 1 : 0);
    const rows = await c.vector.search(large, "comma", {embedding, tags: ["selected"], minImportance: 80, limit: 3});
    expect(rows).toHaveLength(3);
    expect(rows.every(row => row.tenantId === "B" && row.memorySpaceId === large && row.importance >= 80 && row.tags.includes("selected"))).toBe(true);
  } finally { await c.shutdown(); }
});
