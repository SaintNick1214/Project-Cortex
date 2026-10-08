/** Task22 native public reads on an explicitly owned disposable target. */
import { readFileSync } from "node:fs";
import { jsonToConvex } from "convex/values";
import { Cortex } from "../src/index";
const root = process.env.CORTEX_TASK22_PROOF_ROOT;
if (!root || process.env.CONVEX_URL !== "http://127.0.0.1:46110") throw new Error("Task22 owned target required");
const key: string = JSON.parse(readFileSync(`${root}/private-admin.json`, "utf8")).key;
it.each(["A", "B", undefined])("native exact scope/full fact codec/zero windows and ambiguity: %s", async tenantId => {
  const c = new Cortex({convexUrl: process.env.CONVEX_URL!, convexLogger: false, auth: {userId: "actor", tenantId}, resilience: {enabled: false}});
  (c.getClient() as unknown as {setAdminAuth(key: string): void}).setAdminAuth(key);
  try {
    const memory = await c.vector.get("same-space", "mem-same-0");
    expect(memory?.tenantId).toBe(tenantId);
    expect(await c.vector.list({memorySpaceId: "same-space", limit: 0})).toEqual([]);
    expect(await c.vector.search("same-space", "empty", {limit: 0})).toEqual([]);
    const fact = await c.facts.get("same-space", "fact-same-0");
    expect(fact?.tenantId).toBe(tenantId);
    const exported = await c.facts.export({memorySpaceId: "same-space", format: "json"});
    const rows = JSON.parse(exported.data);
    expect(rows).toHaveLength(1);
    expect(jsonToConvex(rows[0].metadata.integer)).toBe(9223372036854775807n);
    expect(new Uint8Array(jsonToConvex(rows[0].metadata.bytes) as ArrayBuffer)).toEqual(new Uint8Array([0, 255]));
    if (tenantId === "A") await expect(c.conversations.get("conv-same-0")).rejects.toThrow("DOMAIN_SCOPE_AMBIGUOUS");
    else {
      expect((await c.conversations.get("conv-same-0"))?.messages).toHaveLength(2);
      expect((await c.conversations.get("conv-same-0", {messageLimit: 0}))?.messages).toEqual([]);
    }
    const other = tenantId === "A" ? "B" : "A";
    if (tenantId !== undefined) await expect(c.vector.get("same-space", "mem-same-0", {tenantId: other})).rejects.toThrow("TENANT_SCOPE_MISMATCH");
  } finally { await c.shutdown(); }
});
it("native composite search fills a scoped filtered window beyond1201 foreign candidates", async () => {
  const c = new Cortex({convexUrl: process.env.CONVEX_URL!, convexLogger: false, auth: {userId: "actor", tenantId: "B"}, resilience: {enabled: false}});
  (c.getClient() as unknown as {setAdminAuth(key: string): void}).setAdminAuth(key);
  try {
    const embedding = Array.from({length: 1536}, (_, i) => i === 0 ? 1 : 0);
    const rows = await c.vector.search("large", "comma", {embedding, tags: ["selected"], minImportance: 80, limit: 3});
    expect(rows).toHaveLength(3);
    expect(rows.every(row => row.tenantId === "B" && row.memorySpaceId === "large" && row.importance >= 80 && row.tags.includes("selected"))).toBe(true);
  } finally { await c.shutdown(); }
});
