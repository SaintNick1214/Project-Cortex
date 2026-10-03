import { describe, expect, it } from "@jest/globals";
import { getFunctionName } from "convex/server";
import { ConvexError, convexToJson, type Value } from "convex/values";
import * as memory from "../../../convex-dev/runtimeMemory";
import * as auth from "../../../convex-dev/runtimeAuth";
import { memoryFixture, registeredHandler } from "./fixture";

const unavailable = { version: 1, code: "CAPABILITY_UNAVAILABLE", message: "Memory capability unavailable.", retryable: false, outcome: "not_dispatched" };
const opaque = { version: 1, code: "INTERNAL_FAILURE", message: "Memory control failed.", retryable: false, outcome: "not_dispatched" };
const args = { tenantId: "tenant-a", memorySpaceId: "space-a", text: "private text", requestId: "native-boundary" };
const keys = ["principalId", "principalVersion", "membershipId", "membershipVersion", "grantId", "grantVersion", "tenantId", "tenantEpoch", "memorySpaceId", "memorySpaceEpoch"].sort();
type Schema = { type: string; value?: unknown };
function nativeSchema(registration: unknown): Schema {
  return JSON.parse((registration as { exportArgs(): string }).exportArgs()) as Schema;
}
/** Validate serialized payload against actual installed exportArgs, including exact object fields. */
function assertNative(schema: Schema, value: unknown): void {
  if (schema.type === "object") {
    expect(value !== null && typeof value === "object" && !Array.isArray(value)).toBe(true);
    const fields = schema.value as Record<string, { fieldType: Schema; optional: boolean }>;
    const record = value as Record<string, unknown>;
    expect(Object.keys(record).filter((key) => !Object.hasOwn(fields, key))).toEqual([]);
    for (const [key, field] of Object.entries(fields)) {
      if (!Object.hasOwn(record, key)) { expect(field.optional).toBe(true); continue; }
      assertNative(field.fieldType, record[key]);
    }
  } else if (schema.type === "union") {
    const alternatives = schema.value as Schema[];
    expect(alternatives.some((choice) => choice.type === "literal" && value === choice.value)).toBe(true);
  } else if (schema.type === "literal") expect(value).toEqual(schema.value);
  else if (schema.type === "string" || schema.type === "number") expect(typeof value).toBe(schema.type);
  else throw new Error(`Unexpected native control schema ${schema.type}`);
}
function setup() {
  const f = memoryFixture(); const payloads: { name: string; raw: unknown; serialized: unknown }[] = [];
  const businessReads: string[] = [];
  const query = f.db.query.bind(f.db); f.db.query = (table) => { if (!table.startsWith("runtimeAuth")) businessReads.push(table); return query(table); };
  const get = f.db.get.bind(f.db); f.db.get = async (table, id) => { if (!table.startsWith("runtimeAuth")) businessReads.push(table); return await get(table, id); };
  const invoke = f.actionCtx.runQuery.bind(f.actionCtx);
  let override: ((name: string, result: unknown) => unknown) | undefined;
  let fault: ((name: string) => void) | undefined;
  f.actionCtx.runQuery = async (ref, input) => {
    const name = getFunctionName(ref); const [module, key] = name.split(":");
    const registration = (module === "runtimeAuth" ? auth : memory) as unknown as Record<string, unknown>;
    const serialized = convexToJson(input as Value);
    assertNative(nativeSchema(registration[key!]), serialized);
    payloads.push({ name, raw: input, serialized });
    fault?.(name);
    const result: unknown = await invoke(ref, input);
    return override ? override(name, result) : result;
  };
  return { ...f, payloads, businessReads, override: (callback: typeof override) => { override = callback; }, fault: (callback: typeof fault) => { fault = callback; } };
}
async function outcome(f: ReturnType<typeof setup>, operation: "remember" | "recall"): Promise<unknown> {
  try { await registeredHandler<typeof args, unknown>(memory[operation])(f.actionCtx as never, args); throw new Error("Expected control rejection"); }
  catch (error) {
    if (error && typeof error === "object" && "data" in error) return error.data;
    throw error;
  }
}
function zero(f: ReturnType<typeof setup>): void {
  expect(f.db.writes).toBe(0); expect(f.businessReads).toEqual([]); expect(f.searches).toEqual([]);
  expect(f.payloads.every((payload) => ["runtimeAuth:authorize", "runtimeMemory:checkAuthority"].includes(payload.name))).toBe(true);
}

describe.each(["remember", "recall"] as const)("native %s control boundary", (operation) => {
  it("projects the actual14-field native auth result to frozen10-field reference", async () => {
    const f = setup(); let fullKeys: string[] = [];
    f.override((name, result) => { if (name === "runtimeAuth:authorize") fullKeys = Object.keys(result as object); return result; });
    expect(await outcome(f, operation)).toEqual(unavailable);
    expect(fullKeys).toHaveLength(14);
    expect(fullKeys.filter((key) => !keys.includes(key)).sort()).toEqual(["actorKind", "capabilities", "resourceAccess", "userId"]);
    const sent = f.payloads[1]!;
    expect(sent.name).toBe("runtimeMemory:checkAuthority");
    const raw = sent.raw as { reference: unknown; capability: string };
    expect(Object.isFrozen(raw.reference)).toBe(true);
    expect(Object.keys((sent.serialized as { reference: object }).reference).sort()).toEqual(keys);
    expect(raw.capability).toBe(operation === "remember" ? "write" : "read");
    expect(raw.reference).toEqual(f.reference); zero(f);
  });
  it("preserves concrete-scope denial when optional native reference keys are omitted", async () => {
    const f = setup();
    f.override((name, result) => {
      if (name !== "runtimeAuth:authorize") return result;
      const { memorySpaceId: _space, memorySpaceEpoch: _epoch, ...rest } = result as Record<string, unknown>;
      return rest;
    });
    expect(await outcome(f, operation)).toEqual({ version: 1, code: "FORBIDDEN", message: "A concrete authorized memory space is required", retryable: false, outcome: "not_dispatched" });
    expect(f.payloads).toHaveLength(1); zero(f);
  });
  it.each(["principal", "membership", "grant"] as const)("preserves the late %s generation fence across native RPC", async (record) => {
    const f = setup(); f.fault((name) => { if (name === "runtimeMemory:checkAuthority") f[record].version = 2; });
    expect(await outcome(f, operation)).toEqual({ version: 1, code: "FORBIDDEN", message: "Access denied", retryable: false, outcome: "not_dispatched" });
    expect(f.payloads).toHaveLength(2); zero(f);
  });
  it("preserves actual static authority-lookup ambiguity without native diagnostics", async () => {
    const f = setup(); f.db.seed("runtimeAuthPrincipals", { ...f.principal, _id: "runtimeAuthPrincipals:duplicate" });
    expect(await outcome(f, operation)).toEqual({ version: 1, code: "AUTHORITY_LOOKUP_AMBIGUOUS", message: "Authority lookup is ambiguous", retryable: false, outcome: "not_dispatched" });
    zero(f);
  });
  for (const location of ["runtimeAuth:authorize", "runtimeMemory:checkAuthority"]) {
    it.each([null, 3, "PRIVATE_RESULT", [], new Date(0), Object.create({ principalId: "private" })] as unknown[])(`malformed ${location} result is opaque (%p)`, async (value) => {
      const f = setup(); f.override((name, result) => name === location ? value : result);
      expect(await outcome(f, operation)).toEqual(opaque); zero(f);
    });
    it.each([
      ["principalId", 1], ["principalVersion", "1"], ["grantVersion", 0],
      ["membershipVersion", 1.5], ["tenantEpoch", Number.NaN], ["memorySpaceEpoch", undefined],
      ["actorKind", "caller"], ["resourceAccess", "global"], ["userId", {}],
      ["capabilities", ["admin", "invented"]], ["PRIVATE_EXTRA", "PRIVATE_RESULT"],
    ] as const)(`invalid ${location} field %s stays opaque`, async (field, value) => {
      const f = setup(); f.override((name, result) => name === location ? { ...result as object, [field]: value } : result);
      expect(await outcome(f, operation)).toEqual(opaque); zero(f);
    });
    it(`capability accessor at ${location} is never invoked`, async () => {
      const f = setup(); let reads = 0;
      const capabilities = ["read", "write"];
      Object.defineProperty(capabilities, "0", { get: () => { reads++; return "PRIVATE_GETTER"; } });
      f.override((name, result) => name === location ? { ...result as object, capabilities } : result);
      expect(await outcome(f, operation)).toEqual(opaque); expect(reads).toBe(0); zero(f);
    });
    it(`authority field getter at ${location} is never invoked`, async () => {
      const f = setup(); let reads = 0;
      f.override((name, result) => {
        if (name !== location) return result;
        const altered = { ...result as object };
        Object.defineProperty(altered, "principalId", { enumerable: true, get: () => { reads++; throw new Error("PRIVATE_GETTER"); } });
        return altered;
      });
      expect(await outcome(f, operation)).toEqual(opaque); expect(reads).toBe(0); zero(f);
    });
    it(`proxy descriptor failure at ${location} stays opaque without diagnostic getters`, async () => {
      const f = setup(); let reads = 0;
      f.override((name, result) => name === location ? new Proxy(result as object, {
        ownKeys: () => { throw new Error("PRIVATE_PROXY"); }, // Async promise assimilation checks then; it is protocol access, not a diagnostic getter.
        get: (_target, key) => { if (key === "then") return undefined; reads++; throw new Error("PRIVATE_GETTER"); },
      }) : result);
      expect(await outcome(f, operation)).toEqual(opaque); expect(reads).toBe(0); zero(f);
    });
    it.each([undefined, null, "PRIVATE_SCALAR", 9, { private: "PRIVATE_STRUCTURED" }, new Error("PRIVATE_CLASS"), new ConvexError({ code: "UNKNOWN_BACKEND_FAILURE", message: "PRIVATE_DIAGNOSTIC", privateControl: "PRIVATE_CONTROL" })])(`unknown ${location} fault is opaque (%p)`, async (value) => {
      const f = setup(); f.fault((name) => { if (name === location) throw value; });
      expect(await outcome(f, operation)).toEqual(opaque); zero(f);
    });
    it(`error/data/message getters at ${location} are never invoked`, async () => {
      const f = setup(); let reads = 0;
      const error = new ConvexError({});
      for (const field of ["data", "message", "stack"]) Object.defineProperty(error, field, { get: () => { reads++; throw new Error("PRIVATE_GETTER"); } });
      f.fault((name) => { if (name === location) throw error; });
      expect(await outcome(f, operation)).toEqual(opaque); expect(reads).toBe(0); zero(f);
    });
    it(`safe-looking data with a getter at ${location} is opaque`, async () => {
      const f = setup(); let reads = 0;
      const error = new ConvexError({}); const data = { ...unavailable };
      Object.defineProperty(data, "message", { enumerable: true, get: () => { reads++; return "PRIVATE_GETTER"; } });
      Object.defineProperty(error, "data", { value: data });
      f.fault((name) => { if (name === location) throw error; });
      expect(await outcome(f, operation)).toEqual(opaque); expect(reads).toBe(0); zero(f);
    });
    it.each([
      { ...unavailable, private: "PRIVATE_EXTRA" }, { ...unavailable, outcome: "confirmed" },
      { ...unavailable, message: "PRIVATE_MESSAGE" }, { ...unavailable, retryable: true },
      { ...unavailable, version: 2 }, { ...unavailable, code: "UNKNOWN" },
    ])(`nonexact ${location} envelope is opaque (%p)`, async (value) => {
      const f = setup(); f.fault((name) => { if (name === location) throw new ConvexError(value); });
      expect(await outcome(f, operation)).toEqual(opaque); zero(f);
    });
    it.each([
      { code: "UNAUTHENTICATED", message: "Verified identity required" },
      { code: "FORBIDDEN", message: "Access denied" },
      { code: "FORBIDDEN", message: "A concrete authorized memory space is required" },
      { code: "INVALID_INPUT", message: "Invalid authority configuration" },
      { code: "AUTHORITY_LOOKUP_AMBIGUOUS", message: "Authority lookup is ambiguous" },
      { code: "CAPABILITY_UNAVAILABLE", message: "Memory capability unavailable." },
    ])(`whole static ${location} envelope remains distinct (%p)`, async (known) => {
      const f = setup(); const value = { version: 1, ...known, retryable: false, outcome: "not_dispatched" };
      f.fault((name) => { if (name === location) throw new ConvexError(value); });
      expect(await outcome(f, operation)).toEqual(value); zero(f);
    });
  }
});
