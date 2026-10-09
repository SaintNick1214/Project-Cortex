import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";
import { localRequest } from "../local-request.js";

describe("trusted local server admission", () => {
  it.each(["https://foreign.example", "null"])("refuses browser origin %s before private effects", async origin => {
    const effect = vi.fn();
    const app = new Hono().use("*", localRequest).post("/chat", context => {
      effect();
      return context.json({ response: "private" });
    });
    const response = await app.request("http://127.0.0.1:3001/chat", {
      method: "POST", headers: { origin, "content-type": "text/plain" },
      body: '{"message":"cross-origin input"}',
    });
    expect(response.status).toBe(403);
    expect(await response.text()).not.toContain("private");
    expect(effect).not.toHaveBeenCalled();
    expect(response.headers.get("access-control-allow-origin")).toBeNull();
  });
  it("refuses a foreign browser origin even when its Host matches", async () => {
    const effect = vi.fn();
    const app = new Hono().use("*", localRequest).get("/recall", context => {
      effect();
      return context.json({ text: "owned memory" });
    });
    const response = await app.request("http://foreign.example:3001/recall", {
      headers: { origin: "http://foreign.example:3001" },
    });
    expect(response.status).toBe(403);
    expect(effect).not.toHaveBeenCalled();
  });
  it.each([undefined, "http://127.0.0.1:3001"])("admits direct or matching-origin local clients: %s", async origin => {
    const effect = vi.fn();
    const app = new Hono().use("*", localRequest).get("/recall", context => {
      effect();
      return context.json({ text: "owned memory" });
    });
    const response = await app.request("http://127.0.0.1:3001/recall", {
      headers: origin ? { origin } : {},
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ text: "owned memory" });
    expect(effect).toHaveBeenCalledOnce();
  });
});
