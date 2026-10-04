import { describe, expect, it } from "@jest/globals";
import * as memories from "../../../convex-dev/memories";
import * as facts from "../../../convex-dev/facts";
import { harness, forbidden } from "./sharedfixtures";
import { semanticHash } from "../../../src/domain/profile";

describe("retained linked and bulk preeffect admissions", () => {
  it.each(["immutable-version", "immutable-control", "mutable-owner", "mutable-control", "conversation-anchor", "peer-version"] as const)(
    "%s invalidation during a later source hash denies the entire multirow delivery", async mode => {
      const h = harness(); const owner = await h.provisionScope();
      const common = { tenantId: owner.tenantId, memorySpaceId: owner.memorySpaceId, ownerPrincipalId: owner.principalId };
      const immutable = await h.db.insert("immutable", { ...common, type: "record", id: "linked", version: 1 });
      const mutable = await h.db.insert("mutable", { ...common, namespace: "record", key: "linked" });
      const conversation = await h.db.insert("conversations", { ...common, conversationId: "linked", messages: [{ id: "anchor" }] });
      const peer = await h.seedData("facts", owner, "peer");
      const links = mode.startsWith("immutable") ? { immutableRef: { type: "record", id: "linked", version: 1 } }
        : mode.startsWith("mutable") ? { mutableRef: { namespace: "record", key: "linked" } }
        : mode === "peer-version" ? { factsRef: { factId: "peer", version: 1 } }
        : { conversationRef: { conversationId: "linked", messageIds: ["anchor"] } };
      await h.seedData("memories", owner, "first", links); await h.seedData("memories", owner, "second");
      const before = structuredClone(h.db.rows); let injected = false; const digest = crypto.subtle.digest;
      crypto.subtle.digest = async (algorithm, data) => {
        if (!injected && new TextDecoder().decode(data).includes("private second")) {
          injected = true;
          if (mode === "immutable-version") await h.db.patch(immutable, { version: 2 });
          else if (mode === "mutable-owner") await h.db.patch(mutable, { ownerPrincipalId: "foreign-owner" });
          else if (mode === "conversation-anchor") await h.db.patch(conversation, { messages: [] });
          else if (mode === "peer-version") await h.db.patch(peer, { version: 2 });
          else await h.db.insert("runtimeAuthTombstones", { tenantId: owner.tenantId, memorySpaceId: owner.memorySpaceId,
            resourceType: "source", resourceId: mode === "immutable-control" ? "immutable:record:linked" : "mutable:record:linked", deletedAt: Date.now() });
        }
        return await digest.call(crypto.subtle, algorithm, data);
      };
      try { await expect(h.invoke(memories.list, { memorySpaceId: "space-a" })).rejects.toMatchObject(forbidden); }
      finally { crypto.subtle.digest = digest; }
      expect(injected).toBe(true); expect(h.db.rows).toEqual(before);
    });

  it.each([false, true])("updateMany retains its original WRITE source before effects, readable=%s", async readable => {
    const h = harness(); const owner = await h.provisionScope({ capabilities: readable ? ["read", "write"] : ["write"] });
    await h.seedData("memories", owner, "first"); await h.seedData("memories", owner, "second");
    const source = h.db.rows.get("runtimeMemorySources")![0];
    const content = "Valid same-revision canonical replacement"; const contentHash = await semanticHash(content);
    const before = structuredClone(h.db.rows); const patch = h.db.patch.bind(h.db); let injected = false;
    h.db.patch = async (tableOrId, idOrFields, fields) => {
      await patch(tableOrId, idOrFields, fields);
      const effectiveId = typeof idOrFields === "string" ? idOrFields : tableOrId;
      if (!injected && effectiveId.startsWith("memories/")) { injected = true; await patch(source._id, { content, contentHash }); }
    };
    await expect(h.invoke(memories.updateMany, { memorySpaceId: "space-a", importance: 77 })).rejects.toMatchObject({ data: { code: "STALE_SOURCE" } });
    expect(injected).toBe(true); expect(h.db.rows).toEqual(before);
    expect(h.db.attemptedWrites.some(write => write.startsWith("patch:memories/"))).toBe(true);
  });

  it.each(["memory", "fact"] as const)("%s anchor reload follows final source reload without starting another digest", async kind => {
    const h = harness(); const owner = await h.provisionScope();
    const conv = await h.db.insert("conversations", { tenantId: owner.tenantId, memorySpaceId: owner.memorySpaceId,
      ownerPrincipalId: owner.principalId, conversationId: "linked", messages: [{ id: "anchor" }] });
    await h.seedData(kind === "memory" ? "memories" : "facts", owner, "first", kind === "memory"
      ? { conversationRef: { conversationId: "linked", messageIds: ["anchor"] } }
      : { sourceRef: { conversationId: "linked", messageIds: ["anchor"] } });
    await h.seedData(kind === "memory" ? "memories" : "facts", owner, "second");
    const before = structuredClone(h.db.rows); const query = h.db.query.bind(h.db); const digest = crypto.subtle.digest;
    let hashes = 0; let secondHashes = 0; let afterLastHash = false; let injected = false; let hashesAtInjection = 0;
    crypto.subtle.digest = async (algorithm, data) => {
      hashes++;
      if (new TextDecoder().decode(data).includes("private second") && ++secondHashes === 2) afterLastHash = true;
      return await digest.call(crypto.subtle, algorithm, data);
    };
    h.db.query = table => {
      const selection = query(table); const unique = selection.unique.bind(selection);
      selection.unique = async () => {
        const row = await unique();
        if (table === "runtimeMemorySources" && afterLastHash && !injected) {
          injected = true; hashesAtInjection = hashes; await h.db.patch(conv, { messages: [] });
        }
        return row;
      };
      return selection;
    };
    try { await expect(h.invoke(kind === "memory" ? memories.list : facts.list, { memorySpaceId: "space-a" })).rejects.toMatchObject(forbidden); }
    finally { crypto.subtle.digest = digest; }
    expect(injected).toBe(true); expect(hashes).toBe(hashesAtInjection); expect(h.db.rows).toEqual(before);
  });
});
