/** Bounded, internal test-only collision/count/rollback datasets. */
import { captureInsertedRow, ensureLifecycleState } from "../../../convex-dev/lib/referenceLifecycle";
import { internalMutation, internalQuery } from "../../../convex-dev/_generated/server";
import { v, ConvexError } from "convex/values";
import type { TableNames } from "../../../convex-dev/_generated/dataModel";

const cases = v.union(...["first", "last", "foreign", "duplicate", "stats", "count", "delete", "rollback", "python", "reconcile"].map(value => v.literal(value)));
const scopes = v.union(v.literal("A"), v.literal("B"), v.literal("none"));
function owned(prefix: string): void {
  if (!/^task17-ci-[0-9a-f-]{36}$/.test(prefix)) throw new ConvexError("FIXTURE_OWNER_REQUIRED");
}

export const seed = internalMutation({
  args: { prefix: v.string(), case: cases, scope: scopes, batch: v.number(), reject: v.optional(v.boolean()) },
  handler: async (ctx, args) => {
    owned(args.prefix);
    await ensureLifecycleState(ctx);
    const c = args.case, batch = args.batch;
    if (!Number.isInteger(batch) || batch < 0 || batch > (c === "count" ? 333 : c === "rollback" ? 39 : c === "duplicate" || c === "reconcile" ? 1 : 0))
      throw new ConvexError("FIXTURE_BATCH_LIMIT");
    if (args.reject) throw new ConvexError("FIXTURE_REJECTED_BEFORE_WRITE");
    const tenantId = args.scope === "none" ? undefined : `${args.prefix}-${args.scope}`;
    const now = Date.now(), space = `${args.prefix}-${c}`, ids: string[] = [];
    const common = { tenantId, createdAt: now, updatedAt: now };
    const metadata = c === "stats" ? { owner: "task17", text: `é🌱${args.prefix}`, bytes: new Uint8Array([0, 255]).buffer, integer: 9223372036854775807n } : { owner: "task17", fixture: args.prefix };
    const addSpace = async (id = space, type: "team" | "custom" = "team") => ids.push(await captureInsertedRow(ctx,"memorySpaces", { ...common, memorySpaceId: id, type, participants: [{ id: "participant", type: "human", joinedAt: 1 }], metadata, status: "active" }));
    const addProfile = async (id = `${space}-user`, index?: number, type = "user") => ids.push(await captureInsertedRow(ctx,"immutable", { ...common, ...(index === undefined ? {} : { createdAt: index, updatedAt: index + 0.5 }), type, id, userId: id, data: { marker: args.scope }, version: 2, previousVersions: [{ version: 1, timestamp: 1, data: { marker: "original" } }], metadata: { fixture: args.prefix } }));
    const addDomains = async (id: string, index = 0, count = false, padding = "") => {
      const selectedSpace = count ? `${args.prefix}-count` : space;
      const userId = count ? `${args.prefix}-count-user` : `${args.prefix}-user`, participantId = count ? "count-participant" : "participant";
      const createdAt = c === "rollback" ? 10000 + index : now;
      const base = { ...common, createdAt, memorySpaceId: selectedSpace, participantId };
      ids.push(await captureInsertedRow(ctx,"conversations", { ...base, conversationId: `conversation-${id}`, type: "user-agent", participants: { userId }, messages: [{ id: "m1", role: "user", content: "native", timestamp: now }], messageCount: 1, metadata }));
      ids.push(await captureInsertedRow(ctx,"memories", { ...base, memoryId: `memory-${id}`, userId, content: padding || "native", contentType: "raw", sourceType: "system", sourceTimestamp: now, importance: 95, tags: ["task17", "tag"], version: 1, previousVersions: [], accessCount: 0, metadata }));
      if (c !== "rollback") ids.push(await captureInsertedRow(ctx,"facts", { ...base, factId: `fact-${id}`, userId, fact: "native", factType: "knowledge", confidence: 75, sourceType: "manual", tags: ["task17", "tag"], version: 1, metadata }));
    };
    if (c === "reconcile") {
      for(let i=0;i<7;i++) ids.push(await captureInsertedRow(ctx,"memories", {...common,createdAt:10000+i,memorySpaceId:space,memoryId:`${space}-${i}`,content:"committed",contentType:"raw",sourceType:"system",sourceTimestamp:now,importance:50,tags:[],version:1,previousVersions:[],accessCount:0}));
    } else if (c === "count") {
      for (let i = batch * 3; i < Math.min(batch * 3 + 3, 1001); i++) {
        await addSpace(`${space}-${i}`, "custom");
        await addProfile(`${space}-user-${i}`, i);
        await addDomains(`${space}-${i}`, i, true);
      }
    } else if (c === "rollback") {
      if (batch === 0) {
        await addSpace();
        ids.push(await captureInsertedRow(ctx,"conversations", { ...common, memorySpaceId: space, conversationId: `${space}-conversation`, type: "user-agent", participants: { userId: "task17-user" }, messages: [], messageCount: 0 }));
      }
      ids.push(await captureInsertedRow(ctx,"memories", { ...common, createdAt: 10000 + batch, memorySpaceId: space, memoryId: `${space}-${batch}`, content: "x".repeat(600000), contentType: "raw", sourceType: "system", sourceTimestamp: now, importance: 50, tags: [], version: 1, previousVersions: [], accessCount: 0 }));
    } else if (c === "python") {
      await addSpace();
    } else {
      await addSpace();
      if (c !== "stats") await addProfile();
      if (!["duplicate", "foreign"].includes(c)) await addDomains(`${space}-${batch}`);
      if (c === "delete") {
        await addProfile(`${space}-audit`, undefined, "audit");
        ids.push(await captureInsertedRow(ctx,"memories", { ...common, memorySpaceId: `${space}-other`, memoryId: `${space}-other-memory`, content: "preserved", contentType: "raw", sourceType: "system", sourceTimestamp: now, importance: 50, tags: [], version: 1, previousVersions: [], accessCount: 0 }));
        ids.push(await captureInsertedRow(ctx,"contexts", { ...common, memorySpaceId: space, contextId: `${space}-context`, purpose: "preserved", depth: 0, childIds: [], status: "active", participants: [], version: 1, previousVersions: [] }));
      }
    }
    return ids;
  },
});

export const readLedgerRows = internalQuery({
  args: { prefix: v.string(), ids: v.array(v.string()) },
  handler: async (ctx, args) => {
    owned(args.prefix);
    if (args.ids.length > 16) throw new ConvexError("FIXTURE_BATCH_LIMIT");
    const tables: TableNames[] = ["memorySpaces", "immutable", "conversations", "memories", "facts", "contexts"];
    const rows = [];
    for (const id of args.ids) {
      const normalized = tables.map(table => ctx.db.normalizeId(table, id)).find(Boolean);
      if (!normalized) throw new ConvexError("FIXTURE_ID_REQUIRED");
      const row = await ctx.db.get(normalized);
      if (!row) continue;
      const record = row as unknown as { memorySpaceId?: string; id?: string };
      if (!(record.memorySpaceId ?? record.id ?? "").startsWith(args.prefix + "-")) throw new ConvexError("FIXTURE_OWNER_REQUIRED");
      rows.push(row);
    }
    return rows;
  },
});
