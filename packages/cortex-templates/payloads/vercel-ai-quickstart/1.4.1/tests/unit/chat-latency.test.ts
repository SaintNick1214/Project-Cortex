import type { UIMessage } from "ai";
import { createChatLatencyTrace } from "../../lib/chat-latency";

const message = (role: UIMessage["role"], text: string): UIMessage => ({ id: role, role, parts: [{ type: "text", text }] });
function fixture(enabled = true) {
  let clock = 100;
  const events: Parameters<Parameters<typeof createChatLatencyTrace>[1]["emit"]>[0][] = [];
  const paints: (() => void)[] = [];
  const cancel = jest.fn();
  const ports = { now: jest.fn(() => clock), emit: jest.fn(event => events.push(event)), visibility: () => "visible",
    afterPaint: jest.fn(callback => { paints.push(callback); return cancel; }) };
  return { trace: createChatLatencyTrace(enabled, ports), events, paints, ports, cancel, tick: (ms: number) => { clock += ms; } };
}
describe("opt-in browser display clock", () => {
  it("measures submission through new assistant DOM commit and an actual caller paint checkpoint", () => {
    const f = fixture(); const old = message("assistant", "OLD_PRIVATE_TEXT"); f.trace.begin(1); f.tick(50);
    f.trace.bind(`run:${"a".repeat(64)}`); f.tick(70);
    f.trace.committed([old, message("user", "PRIVATE_PROMPT"), message("assistant", " ")]);
    expect(f.events.map(event => event.phase)).toEqual(["submit", "admission.delivered"]);
    f.trace.committed([old, message("user", "PRIVATE_PROMPT"), message("assistant", "PRIVATE_REPLY")]);
    expect(f.events.at(-1)).toMatchObject({ phase: "first-text.dom-commit", elapsedMs: 120 });
    f.tick(32); f.paints[0]();
    expect(f.events.at(-1)).toEqual({ type: "cortex-browser-latency", phase: "first-text.after-paint", elapsedMs: 152, runId: `run:${"a".repeat(64)}`, visibility: "visible" });
    expect(JSON.stringify(f.events)).not.toMatch(/PRIVATE|OLD_PRIVATE/);
    f.trace.committed([message("assistant", "another delta")]); expect(f.paints).toHaveLength(1);
  });
  it("records response and transport completion separately exactly once", () => {
    const f = fixture(), runId = `run:${"a".repeat(64)}`, id = `cortex:${runId}:assistant`; f.trace.begin(0); f.trace.bind(runId);
    f.tick(1000); f.trace.responseStatusComplete(runId); f.trace.responseStatusComplete(runId);
    // Metadata completion must not certify drained canonical text or a DOM commit.
    f.trace.committed([{ ...message("assistant", "draft"), id }]);
    expect(f.events.some(event => event.phase === "answer.complete.dom-commit")).toBe(false);
    f.tick(100); f.trace.transportComplete(id); f.trace.transportComplete(id);
    f.tick(10); f.trace.committed([{ ...message("assistant", "final"), id }]);
    expect(f.events.filter(event => event.phase.includes("complete") || event.phase.includes("status")).map(event => [event.phase, event.elapsedMs]))
      .toEqual([["response.status.dom-commit", 1000], ["transport.complete", 1100], ["answer.complete.dom-commit", 1110]]);
    f.trace.begin(1); f.trace.bind(`run:${"b".repeat(64)}`); f.trace.responseStatusComplete(runId); f.trace.transportComplete(id);
    expect(f.events.filter(event => event.phase === "response.status.dom-commit")).toHaveLength(1);
    f.trace.responseStatusComplete(`run:${"b".repeat(64)}`); expect(f.events.filter(event => event.phase === "response.status.dom-commit")).toHaveLength(2);
  });
  it("suppresses stale paint callbacks after a new submission or component disposal", () => {
    const f = fixture(); f.trace.begin(0); f.trace.committed([message("assistant", "one")]);
    f.trace.begin(0); f.paints[0](); expect(f.events.filter(event => event.phase.endsWith("after-paint"))).toHaveLength(0);
    f.trace.committed([message("assistant", "two")]); f.trace.dispose(); f.paints[1]();
    expect(f.events.filter(event => event.phase.endsWith("after-paint"))).toHaveLength(0); expect(f.cancel).toHaveBeenCalledTimes(2);
  });
  it("does no diagnostic work when disabled or before submission", () => {
    const f = fixture(false); f.trace.begin(0); f.trace.bind("PRIVATE_ID"); f.trace.committed([message("assistant", "reply")]); f.trace.responseStatusComplete("PRIVATE_ID"); f.trace.transportComplete("PRIVATE_ID"); f.trace.failed();
    expect(f.ports.now).not.toHaveBeenCalled(); expect(f.ports.emit).not.toHaveBeenCalled(); expect(f.ports.afterPaint).not.toHaveBeenCalled();
    const unused = fixture(); unused.trace.bind("unused"); unused.trace.committed([message("assistant", "old")]); expect(unused.events).toHaveLength(0);
  });
  it("never logs an untrusted run identity and isolates failed diagnostic callbacks", () => {
    const f = fixture(); f.trace.begin(0); f.trace.bind("PRIVATE_UNTRUSTED_ID"); expect(f.events.at(-1)?.runId).toBeUndefined();
    f.ports.emit.mockImplementation(() => { throw Error("diagnostics"); });
    expect(() => f.trace.failed()).not.toThrow(); expect(() => f.trace.committed([message("assistant", "reply")])).not.toThrow();
  });
});
