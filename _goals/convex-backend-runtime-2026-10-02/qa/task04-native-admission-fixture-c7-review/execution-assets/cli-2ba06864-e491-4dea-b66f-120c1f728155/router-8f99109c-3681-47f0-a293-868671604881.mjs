// work/resume/task04-native-admission-fixture-c7-review/independent-c4421e44-de81-45e2-bdaa-f99d1fdf0640/cli-2ba06864-e491-4dea-b66f-120c1f728155/ca83dfb5-260a-405a-916d-d3eec4b3194a/convex/http.ts
import { httpRouter } from "convex/server";

// work/resume/task04-native-admission-fixture-c7-review/independent-c4421e44-de81-45e2-bdaa-f99d1fdf0640/cli-2ba06864-e491-4dea-b66f-120c1f728155/ca83dfb5-260a-405a-916d-d3eec4b3194a/convex/_generated/server.js
import {
  actionGeneric,
  httpActionGeneric,
  queryGeneric,
  mutationGeneric,
  internalActionGeneric,
  internalMutationGeneric,
  internalQueryGeneric
} from "convex/server";
var internalQuery = internalQueryGeneric;
var internalMutation = internalMutationGeneric;
var httpAction = httpActionGeneric;
var env = process.env;

// work/resume/task04-native-admission-fixture-c7-review/independent-c4421e44-de81-45e2-bdaa-f99d1fdf0640/cli-2ba06864-e491-4dea-b66f-120c1f728155/ca83dfb5-260a-405a-916d-d3eec4b3194a/convex/qualificationPeer.ts
import { v } from "convex/values";
import { makeFunctionReference } from "convex/server";
var fixedRun = "admission-a6f48c36ac2cd274d7b26ff3e6fbbf8a";
var fields = { run: v.string(), dispatchDigest: v.string() };
function valid(run, digest) {
  if (run !== fixedRun || !/^admission-[a-f0-9]{32}$/.test(run) || !/^[a-f0-9]{64}$/.test(digest)) throw new Error("QA_PEER_INVALID");
}
var record = internalMutation({ args: fields, handler: async (ctx, args) => {
  valid(args.run, args.dispatchDigest);
  const rows = await ctx.db.query("qaAdmissionPeerEffects").withIndex("by_run_dispatch", (q) => q.eq("run", args.run).eq("dispatchDigest", args.dispatchDigest)).take(2);
  if (rows.length > 1) throw new Error("QA_PEER_AMBIGUOUS");
  const row = rows[0];
  if (row) {
    if (row.requestCount >= 8) throw new Error("QA_PEER_BUDGET");
    await ctx.db.patch("qaAdmissionPeerEffects", row._id, { requestCount: row.requestCount + 1 });
  } else await ctx.db.insert("qaAdmissionPeerEffects", { ...args, requestCount: 1, effectCount: 1, createdAt: Date.now() });
  return { requestCount: row ? row.requestCount + 1 : 1, effectCount: 1 };
} });
var counter = internalQuery({ args: fields, handler: async (ctx, args) => {
  valid(args.run, args.dispatchDigest);
  const rows = await ctx.db.query("qaAdmissionPeerEffects").withIndex("by_run_dispatch", (q) => q.eq("run", args.run).eq("dispatchDigest", args.dispatchDigest)).take(2);
  if (rows.length > 1) throw new Error("QA_PEER_AMBIGUOUS");
  return { requestCount: rows[0]?.requestCount ?? 0, effectCount: rows[0]?.effectCount ?? 0 };
} });
function same(a, b) {
  let different = a.length ^ b.length;
  for (let i = 0; i < 128; i++) different |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return different === 0;
}
var effect = httpAction(async (ctx, request) => {
  const denied = () => new Response("denied", { status: 403, headers: { "Content-Type": "text/plain", "Cache-Control": "no-store" } });
  const secret = process.env.CORTEX_QA_TASK04_PEER_SECRET, supplied = request.headers.get("x-cortex-qa-peer") ?? "";
  if (!secret || secret.length < 32 || secret.length > 128 || supplied.length > 128 || !same(secret, supplied) || request.method !== "POST") return denied();
  if (Number(request.headers.get("content-length") ?? 0) > 2048) return denied();
  try {
    const reader = request.body?.getReader();
    if (!reader) return denied();
    let length = 0;
    const chunks = [];
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > 2048) {
        await reader.cancel();
        return denied();
      }
      chunks.push(value);
    }
    const all = new Uint8Array(length);
    let cursor = 0;
    for (const chunk of chunks) {
      all.set(chunk, cursor);
      cursor += chunk.length;
    }
    const args = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(all));
    if (!args || typeof args !== "object" || Array.isArray(args) || Object.keys(args).sort().join(",") !== "dispatchDigest,run") return denied();
    const object = args;
    if (typeof object.run !== "string" || typeof object.dispatchDigest !== "string") return denied();
    valid(object.run, object.dispatchDigest);
    const result = await ctx.runMutation(makeFunctionReference("qualificationPeer:record"), { run: object.run, dispatchDigest: object.dispatchDigest });
    return new Response(JSON.stringify(result), { status: 200, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
  } catch {
    return denied();
  }
});

// work/resume/task04-native-admission-fixture-c7-review/independent-c4421e44-de81-45e2-bdaa-f99d1fdf0640/cli-2ba06864-e491-4dea-b66f-120c1f728155/ca83dfb5-260a-405a-916d-d3eec4b3194a/convex/http.ts
var router = httpRouter();
router.route({ path: "/qa/task04-peer/effect", method: "POST", handler: effect });
var http_default = router;
export {
  effect,
  http_default as router
};
