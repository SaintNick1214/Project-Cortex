import { describe, expect, it } from "@jest/globals";
import { bindTextSubmission, comparePosition, normalizeTextSubmit } from "../../../src/domain/transcript";
import { canonicalModelJson } from "../../../src/domain/model-policy";
const scope = { tenantId: "tenant-a", memorySpaceId: "space-a", principalId: "principal-a" };
const request = () => ({ version: 1, agentId: "agent-a", agentVersion: 1, clientRequestId: "request-a",
  parts: [{ type: "text", text: " a " }, { type: "text", text: "😀" }, { type: "text", text: "" }] });
describe("strict frozen TextSubmitV1", () => {
  it("retains exact whitespace, empty individual parts, order and boundaries on detached graph", () => {
    const value = request(); const normalized = normalizeTextSubmit(value);
    expect(normalized.userInput).toEqual({ role: "user", parts: value.parts }); expect(normalized.userInput.parts).not.toBe(value.parts);
    expect(normalized.conversationSelector).toEqual({ kind: "create" }); expect(normalized.agentSelector).toEqual({ agentId: "agent-a", version: 1 });
  });
  it.each(["reference", "scope", "model", "branch", "messages", "instructions", "options", "conversation", "agent", "visibility"])("rejects undeclared %s without getter execution", key => {
    let invoked = 0; const value = Object.defineProperty(request(), key, { enumerable: true, get: () => { invoked++; return {}; } });
    expect(() => normalizeTextSubmit(value)).toThrow("INVALID_INPUT"); expect(invoked).toBe(0);
    expect(() => normalizeTextSubmit({ ...request(), [key]: {} })).toThrow("INVALID_INPUT");
  });
  it.each([null, "", " ", 1, false])("rejects present invalid conversation selector %s", value => expect(() => normalizeTextSubmit({ ...request(), conversationId: value })).toThrow());
  it.each([0, -1, 1.5, Infinity, NaN, true, Number.MAX_SAFE_INTEGER + 1])("rejects invalid agent version %s", agentVersion => expect(() => normalizeTextSubmit({ ...request(), agentVersion })).toThrow());
  it.each(["\ud800", "\udc00", "x\ud800a"])("rejects malformed Unicode", text => expect(() => normalizeTextSubmit({ ...request(), parts: [{ type: "text", text }] })).toThrow());
  it("rejects sparse/accessor/extra-property/foreign-prototype/nonenumerable graphs before map/getter", () => {
    let calls = 0; const sparse = new Array(2); sparse[1] = { type: "text", text: "x" };
    const getter = [{ type: "text", text: "x" }]; Object.defineProperty(getter, "0", { enumerable: true, get: () => { calls++; return {}; } });
    const ownMap = [{ type: "text", text: "x" }]; Object.defineProperty(ownMap, "map", { enumerable: true, value: () => { calls++; return []; } });
    const extra = Object.assign([{ type: "text", text: "x" }], { hidden: true });
    const foreign = Object.setPrototypeOf([{ type: "text", text: "x" }], {});
    for (const parts of [sparse, getter, ownMap, extra, foreign]) expect(() => normalizeTextSubmit({ ...request(), parts })).toThrow();
    const hidden = request(); Object.defineProperty(hidden, "agentId", { value: "agent-a", enumerable: false }); expect(() => normalizeTextSubmit(hidden)).toThrow(); expect(calls).toBe(0);
  });
  it("enforces part, text byte and client scalar limits without collapsing input", () => {
    expect(() => normalizeTextSubmit({ ...request(), parts: [] })).toThrow();
    expect(() => normalizeTextSubmit({ ...request(), parts: Array.from({ length: 129 }, () => ({ type: "text", text: "x" })) })).toThrow();
    expect(() => normalizeTextSubmit({ ...request(), parts: [{ type: "text", text: "" }] })).toThrow();
    expect(normalizeTextSubmit({ ...request(), parts: [{ type: "text", text: "€".repeat(40_000) }] }).publicRequest.parts[0].text).toHaveLength(40_000);
    expect(() => normalizeTextSubmit({ ...request(), parts: [{ type: "text", text: "€".repeat(40_001) }] })).toThrow();
    expect(normalizeTextSubmit({ ...request(), clientRequestId: "😀".repeat(128) }).publicRequest.clientRequestId).toHaveLength(256);
    expect(() => normalizeTextSubmit({ ...request(), clientRequestId: "a".repeat(129) })).toThrow();
  });
  it("uses input-independent scoped create identity, preserving exact canonical payload conflicts", async () => {
    const a = await bindTextSubmission(request(), scope); const changed = await bindTextSubmission({ ...request(), agentVersion: 2, parts: [{ type: "text", text: "changed" }] }, scope);
    expect(a.identityCanonical).toEqual(changed.identityCanonical); expect(a.identityHash).toEqual(changed.identityHash); expect(a.requestCanonical).not.toBe(changed.requestCanonical);
    expect(a.ledgerRequestId).toHaveLength(74); expect(JSON.parse(a.requestCanonical)).toEqual({ version: 1, identity: JSON.parse(a.identityCanonical), publicRequest: request() });
    for (const narrowed of [{ ...scope, tenantId: "tenant-b" }, { ...scope, memorySpaceId: "space-b" }, { ...scope, principalId: "principal-b" }]) {
      expect((await bindTextSubmission(request(), narrowed)).identityHash).not.toBe(a.identityHash);
    }
    expect((await bindTextSubmission({ ...request(), conversationId: "conversation-a" }, scope)).identityHash).not.toBe(a.identityHash);
  });
  it("checks exact 180000 wrapper bytes, including escaped text and trusted scope, before binding", async () => {
    const value = { ...request(), parts: [{ type: "text", text: "\u0000".repeat(29_000) }] };
    const initial = await bindTextSubmission(value, scope); const padding = 180_000 - Buffer.byteLength(initial.requestCanonical);
    expect(padding).toBeGreaterThan(0); value.parts[0].text += "a".repeat(padding);
    const exact = await bindTextSubmission(value, scope); expect(Buffer.byteLength(exact.requestCanonical)).toBe(180_000);
    expect(() => canonicalModelJson(value)).not.toThrow(); await expect(bindTextSubmission({ ...value, parts: [{ type: "text", text: value.parts[0].text + "a" }] }, scope)).rejects.toThrow();
  });
  it("orders exact steps lexicographically and rejects invalid positions", () => {
    expect(comparePosition({ order: 1, stepOrder: 0 }, { order: 1, stepOrder: 1 })).toBeLessThan(0);
    expect(comparePosition({ order: 2, stepOrder: 0 }, { order: 1, stepOrder: 10 })).toBeGreaterThan(0);
    expect(() => comparePosition({ order: 1, stepOrder: NaN }, { order: 1, stepOrder: 0 })).toThrow();
  });
});
