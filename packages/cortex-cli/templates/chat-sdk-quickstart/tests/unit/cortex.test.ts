import type { AuthContext } from "@cortexmemory/sdk";
import { describe, expect, it } from "vitest";
import {
  getAgentId,
  getCortex,
  getCortexWithAuth,
  getMemorySpaceId,
} from "@/lib/cortex";
import {
  bearer,
  body,
  exact,
  identifier,
  requestBytes,
} from "@/lib/runtime/server";

describe("verified request boundary", () => {
  it("retires the anonymous singleton", () =>
    expect(getCortex).toThrow("verified host JWT"));
  it("rejects AuthContext labels as authority", () =>
    expect(() =>
      getCortexWithAuth({ userId: "claimed" } as AuthContext)
    ).toThrow("not a verified"));
  it("reads configured space as a selector", () => {
    process.env.CORTEX_MEMORY_SPACE_ID = "space";
    expect(getMemorySpaceId()).toBe("space");
  });
  it("reads configured Agent selector", () => {
    process.env.CORTEX_AGENT_ID = "agent";
    expect(getAgentId()).toBe("agent");
  });
  it("accepts the exact bearer form", () =>
    expect(
      bearer(
        new Request("http://localhost", {
          headers: { Authorization: "Bearer abc.def.sig" },
        })
      )
    ).toBe("abc.def.sig"));
  it.each([undefined, "Basic token", "Bearer  invalid"])(
    "rejects malformed bearer %s",
    (value) =>
      expect(() =>
        bearer(
          new Request("http://localhost", {
            headers: value ? { Authorization: value } : {},
          })
        )
      ).toThrow("UNAUTHENTICATED")
  );
  it("rejects caller authority/model extras", () =>
    expect(() =>
      exact({ modelId: "invented", prompt: "x" }, ["prompt"])
    ).toThrow("INVALID_INPUT"));
  it("rejects unbounded identifiers", () =>
    expect(() => identifier("x".repeat(257))).toThrow());
  it("reads bounded exact JSON", async () =>
    expect(
      await body(
        new Request("http://localhost", {
          body: '{"text":"ok"}',
          headers: { "Content-Type": "application/json" },
          method: "POST",
        })
      )
    ).toEqual({ text: "ok" }));
  it("denies oversize bytes before returning input", async () => {
    await expect(
      requestBytes(
        new Request("http://localhost", { body: "123456", method: "POST" }),
        5
      )
    ).rejects.toMatchObject({ code: "INPUT_TOO_LARGE" });
  });
});
