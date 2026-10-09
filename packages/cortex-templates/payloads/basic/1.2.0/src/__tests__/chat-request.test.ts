import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { request } from "node:http";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createChatHandler, MAX_CHAT_BODY_BYTES } from "../chat-request.js";
import { localRequest } from "../local-request.js";

const servers: ReturnType<typeof serve>[] = [];
afterEach(async () => {
  await Promise.all(servers.splice(0).map(server => new Promise<void>((resolve, reject) => {
    server.close(error => error ? reject(error) : resolve());
    if ("closeAllConnections" in server) server.closeAllConnections();
  })));
});

async function fixture() {
  const result = { response: "accepted", conversationId: "generated", memoriesRecalled: 1, factsRecalled: 2 };
  const chat = vi.fn(async () => result);
  const generateId = vi.fn(() => "generated");
  const app = new Hono().use("*", localRequest).post("/chat", createChatHandler(chat, generateId));
  const server = serve({ fetch: app.fetch, port: 0, hostname: "127.0.0.1" });
  servers.push(server);
  if (!server.listening) await new Promise<void>(resolve => server.once("listening", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("HTTP fixture has no port");
  const url = `http://127.0.0.1:${address.port}/chat`;
  return { url, chat, generateId, result };
}

function chunkedPost(url: string, chunks: string[]): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const req = request(url, { method: "POST", headers: { "content-type": "application/json" } }, res => {
      let body = "";
      res.setEncoding("utf8");
      res.on("data", chunk => { body += chunk; });
      res.on("end", () => resolve({ status: res.statusCode!, body }));
      res.on("error", reject);
    });
    req.on("error", reject);
    for (const chunk of chunks) req.write(chunk);
    req.end();
  });
}

describe("production Basic chat admission over HTTP", () => {
  it.each([undefined, "existing-conversation"])("passes only bounded strings, conversation %s", async conversationId => {
    const f = await fixture();
    const response = await fetch(f.url, { method: "POST", body: JSON.stringify({ message: "hello", conversationId }) });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(f.result);
    expect(f.chat).toHaveBeenCalledExactlyOnceWith("hello", conversationId ?? "generated");
    expect(f.generateId).toHaveBeenCalledTimes(conversationId ? 0 : 1);
  });
  it.each([
    null, [], new Array(20_000).fill({}),
    { message: new Array(16_000).fill(2) },
    { message: "hello", conversationId: [] },
    { message: "hello", extra: new Array(16_000).fill(2) },
    { message: " " }, { message: "a".repeat(16 * 1024 + 1) },
    { message: "hello", conversationId: "a".repeat(257) },
  ])("refuses invalid object/array or field bounds before SDK effects: case %#", async body => {
    const f = await fixture();
    const response = await fetch(f.url, { method: "POST", body: JSON.stringify(body) });
    expect(response.status).toBe(400);
    expect(await response.json()).toHaveProperty("error");
    expect(f.chat).not.toHaveBeenCalled();
    expect(f.generateId).not.toHaveBeenCalled();
  });
  it("accepts the exact message length boundary", async () => {
    const f = await fixture();
    const message = "a".repeat(16 * 1024);
    const response = await fetch(f.url, { method: "POST", body: JSON.stringify({ message }) });
    expect(response.status).toBe(200);
    expect(f.chat).toHaveBeenCalledExactlyOnceWith(message, "generated");
  });
  it("rejects a declared oversize body before JSON parsing or SDK effects", async () => {
    const f = await fixture();
    const response = await fetch(f.url, { method: "POST", body: "[" + "x".repeat(MAX_CHAT_BODY_BYTES) });
    expect(response.status).toBe(413);
    expect(f.chat).not.toHaveBeenCalled();
  });
  it("counts streamed bytes without Content-Length before JSON parsing or SDK effects", async () => {
    const f = await fixture();
    const response = await chunkedPost(f.url, ["[", "x".repeat(32 * 1024), "x".repeat(32 * 1024)]);
    expect(response.status).toBe(413);
    expect(JSON.parse(response.body)).toEqual({ error: "Request body is too large" });
    expect(f.chat).not.toHaveBeenCalled();
  });
  it("admits valid chunked JSON without Content-Length", async () => {
    const f = await fixture();
    const response = await chunkedPost(f.url, ['{"message":', '"hello"}']);
    expect(response.status).toBe(200);
    expect(f.chat).toHaveBeenCalledExactlyOnceWith("hello", "generated");
  });
  it("rejects malformed JSON and foreign origins before SDK effects", async () => {
    const f = await fixture();
    const malformed = await fetch(f.url, { method: "POST", body: '{"message":' });
    expect(malformed.status).toBe(400);
    const foreign = await fetch(f.url, { method: "POST", headers: { origin: "https://foreign.example" }, body: '{"message":"hello"}' });
    expect(foreign.status).toBe(403);
    expect(f.chat).not.toHaveBeenCalled();
  });
  it("preserves the chat error status after valid admission", async () => {
    const f = await fixture();
    f.chat.mockRejectedValueOnce(new Error("Chat unavailable"));
    const response = await fetch(f.url, { method: "POST", body: '{"message":"hello"}' });
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "Chat unavailable" });
    expect(f.chat).toHaveBeenCalledOnce();
  });
});
