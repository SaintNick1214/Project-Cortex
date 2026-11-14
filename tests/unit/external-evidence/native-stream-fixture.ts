/** Installed Agent stream/message handlers over controlled component DB and scheduler ports.
 * The async iterator is the database port: convex-helpers owns merging, caps and pagination.
 * Scheduled work remains paused unless explicitly resumed; this is not hosted OCC evidence.
 */
import type { MutationCtx } from "../../../convex-dev/_generated/server";
import { clone, clock } from "../runtimeTranscript/fixture";
import type { dependencyFixture } from "./agent-dependency-fixture";
import * as streams from "../../../node_modules/@convex-dev/agent/dist/component/streams.js";
import * as messages from "../../../node_modules/@convex-dev/agent/dist/component/messages.js";

type Row = Record<string, unknown>;
type Scheduled = { id: string; delay: number; ref: unknown; args: Record<string, unknown>; state: { kind: string } };
type Fixture = Awaited<ReturnType<typeof dependencyFixture>>;
function field(row: Row, key: string): unknown {
  return key.split(".").reduce<unknown>((value, part) => value && typeof value === "object" ? (value as Row)[part] : undefined, row);
}
function compare(a: unknown, b: unknown): number {
  if (a === b) return 0;
  if (a === undefined) return -1;
  if (b === undefined) return 1;
  return (a as string | number) < (b as string | number) ? -1 : 1;
}

export function nativeStreamFixture(f: Fixture) {
  const rows = new Map<string, Map<string, Row>>(), scheduled: Scheduled[] = [];
  const calls: { path: string; args: Record<string, unknown>; before: number; after: number }[] = [];
  let sequence = 0;
  const table = (name: string): Map<string, Row> => {
    if (name === "messages") return f.native.messages;
    if (!rows.has(name)) rows.set(name, new Map());
    return rows.get(name)!;
  };
  const seed = (name: string, value: Row) => {
    const row = { ...clone(value), _id: typeof value._id === "string" ? value._id : `${name}:${++sequence}`, _creationTime: clock };
    table(name).set(row._id, row); return row._id;
  };
  const query = (name: string) => {
    const filters: ((row: Row) => boolean)[] = [];
    let keys = ["_creationTime", "_id"], direction = 1;
    const selected = () => [...table(name).values()].filter(row => filters.every(test => test(row))).sort((a, b) => {
      for (const key of keys) { const result = compare(field(a, key), field(b, key)); if (result) return direction * result; }
      return 0;
    });
    const bounds = {
      eq: (key: string, value: unknown) => { filters.push(row => field(row, key) === value); return bounds; },
      gt: (key: string, value: unknown) => { filters.push(row => compare(field(row, key), value) > 0); return bounds; },
      gte: (key: string, value: unknown) => { filters.push(row => compare(field(row, key), value) >= 0); return bounds; },
      lt: (key: string, value: unknown) => { filters.push(row => compare(field(row, key), value) < 0); return bounds; },
      lte: (key: string, value: unknown) => { filters.push(row => compare(field(row, key), value) <= 0); return bounds; },
    };
    const builder = {
      withIndex: (index: string, callback: (q: typeof bounds) => unknown) => {
        const fields: Record<string, string[]> = { threadId_state_order_stepOrder: ["threadId", "state.kind", "order", "stepOrder"], streamId_start_end: ["streamId", "start", "end"] };
        if (!(index in fields)) throw new Error(`Unexpected native index ${name}.${index}`);
        keys = [...fields[index], "_creationTime", "_id"]; callback(bounds); return builder;
      },
      order: (order: string) => { direction = order === "desc" ? -1 : 1; return builder; },
      take: async (count: number) => clone(selected().slice(0, count)),
      [Symbol.asyncIterator]: async function* () { for (const row of selected()) yield clone(row); },
    };
    return builder;
  };
  const ctx = {
    db: {
      query, normalizeId: (name: string, id: string) => id.startsWith(`${name}:`) ? id : null,
      get: async (name: string, id: string) => clone(table(name).get(id) ?? null),
      insert: async (name: string, value: Row) => seed(name, value),
      patch: async (name: string, id: string, value: Row) => {
        const row = table(name).get(id); if (!row) throw new Error(`Missing native ${name}:${id}`); Object.assign(row, clone(value));
      },
      delete: async (name: string, id: string) => { table(name).delete(id); },
      system: { get: async (_name: string, id: string) => clone(scheduled.find(job => job.id === id) ?? null) },
    },
    scheduler: {
      runAfter: async (delay: number, ref: unknown, args: Record<string, unknown>) => {
        const id = `native-scheduled:${scheduled.length + 1}`; scheduled.push({ id, delay, ref, args: clone(args), state: { kind: "pending" } }); return id;
      },
      cancel: async (id: string) => { const job = scheduled.find(item => item.id === id); if (!job) throw new Error("Missing native schedule"); job.state.kind = "cancelled"; },
    },
  };
  const call = async <T = unknown>(registration: unknown, args: unknown): Promise<T> =>
    await (registration as { _handler(ctx: unknown, args: unknown): Promise<T> })._handler(ctx, args);
  const streamHandlers: Record<string, unknown> = { create: streams.create, addDelta: streams.addDelta, finish: streams.finish,
    list: streams.list, listDeltas: streams.listDeltas, abort: streams.abort, deleteStreamAsync: streams.deleteStreamAsync };
  const handler = (path?: string) => path?.includes("/streams/") ? streamHandlers[path.split("/").at(-1)!]
    : path?.endsWith("/messages/deleteByIds") ? messages.deleteByIds : undefined;
  const oldQuery = f.ctx.runQuery.bind(f.ctx), oldMutation = f.ctx.runMutation.bind(f.ctx);
  const invoke = async (path: string, registration: unknown, args: unknown) => {
    const record = { path, args: clone(args as Row), before: table("streamDeltas").size, after: -1 };
    calls.push(record); const result = await call(registration, args); record.after = table("streamDeltas").size; return result;
  };
  f.ctx.runQuery = (async (ref, args) => {
    const path = (ref as Partial<Record<symbol, string>>)[Symbol.for("toReferencePath")], registration = handler(path);
    return registration ? invoke(path!, registration, args) : oldQuery(ref, args);
  }) as MutationCtx["runQuery"];
  f.ctx.runMutation = (async (ref, args) => {
    const path = (ref as Partial<Record<symbol, string>>)[Symbol.for("toReferencePath")], registration = handler(path);
    return registration ? invoke(path!, registration, args) : oldMutation(ref, args);
  }) as MutationCtx["runMutation"];
  return { table, seed, scheduled, calls, call, streams, messages,
    async resumeDeletion(streamId: string) {
      const job = scheduled.find(item => item.delay === 0 && item.args.streamId === streamId && item.state.kind === "pending");
      if (!job) throw new Error("No pending native stream continuation");
      job.state.kind = "inProgress"; await call(streams.deleteStreamAsync, job.args); job.state.kind = "success";
    },
  };
}
