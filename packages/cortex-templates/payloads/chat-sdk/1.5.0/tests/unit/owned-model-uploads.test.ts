import { convertToModelMessages } from "ai";
import { beforeEach, expect, test, vi } from "vitest";
import { resolveOwnedModelUploads } from "@/lib/owned-model-uploads";
import type { ChatMessage } from "@/lib/types";

const state = vi.hoisted(() => ({ verify: vi.fn() }));
vi.mock("@/lib/private-backend", () => ({
  privateConfiguration: () => ({ convexUrl: "http://127.0.0.1:3218" }),
  privateCall: state.verify,
}));
const scope = { userId: "owner", tenantId: "tenant", memorySpaceId: "owned" };
const url = "http://127.0.0.1:3218/api/storage/owned-image";
const signal = new AbortController().signal;
const messages = (updates: Record<string, unknown> = {}): ChatMessage[] =>
  [
    {
      id: "message",
      role: "user",
      parts: [
        {
          type: "file",
          url,
          mediaType: "image/png",
          name: "owned.png",
          ...updates,
        },
      ],
    },
  ] as unknown as ChatMessage[];
beforeEach(() => {
  state.verify.mockResolvedValue(true);
});
test("registered owned bytes reach actual model conversion while persisted URLs stay unchanged", async () => {
  const bytes = new Uint8Array([137, 80, 78, 71]);
  vi.mocked(fetch).mockResolvedValue(
    new Response(bytes, { headers: { "content-type": "image/png" } })
  );
  const original = messages();
  const resolved = await resolveOwnedModelUploads(original, scope, signal);
  expect(state.verify).toHaveBeenCalledExactlyOnceWith(
    "app/chatData:verifyUploads",
    {
      ...scope,
      files: [{ url, name: "owned.png", mediaType: "image/png" }],
    }
  );
  expect(fetch).toHaveBeenCalledWith(
    url,
    expect.objectContaining({ credentials: "omit", redirect: "error" })
  );
  expect(JSON.stringify(await convertToModelMessages(resolved))).toContain(
    "data:image/png;base64,iVBORw=="
  );
  expect(JSON.stringify(await convertToModelMessages(resolved))).not.toContain(
    "127.0.0.1"
  );
  expect(original).toEqual(messages());
});
test("foreign registered ownership refusal occurs before any body fetch", async () => {
  state.verify.mockRejectedValue(new Error("owned fixture refusal"));
  await expect(
    resolveOwnedModelUploads(messages(), scope, signal)
  ).rejects.toThrow("owned fixture refusal");
  expect(fetch).not.toHaveBeenCalled();
});
test.each([
  "http://127.0.0.1:9999/api/storage/owned-image",
  "http://127.0.0.1:3218/api/function",
  "http://user:password@127.0.0.1:3218/api/storage/owned-image",
  "http://127.0.0.1:3218/api/storage/owned-image#fragment",
])("verified registration does not permit an arbitrary fetch target: %s", async (target) => {
  await expect(
    resolveOwnedModelUploads(messages({ url: target }), scope, signal)
  ).rejects.toMatchObject({ statusCode: 400 });
  expect(fetch).not.toHaveBeenCalled();
});
test("unexpected MIME cancels the storage body and never emits model data", async () => {
  const cancel = vi.fn();
  const body = new ReadableStream({ cancel });
  vi.mocked(fetch).mockResolvedValue(
    new Response(body, { headers: { "content-type": "text/plain" } })
  );
  await expect(
    resolveOwnedModelUploads(messages(), scope, signal)
  ).rejects.toMatchObject({ statusCode: 400 });
  expect(cancel).toHaveBeenCalledOnce();
});
test("streaming size refusal cancels and unlocks the actual reader", async () => {
  const cancel = vi.fn();
  const body = new ReadableStream({
    start(controller) {
      controller.enqueue(new Uint8Array(10 * 1024 * 1024 + 1));
    },
    cancel,
  });
  vi.mocked(fetch).mockResolvedValue(
    new Response(body, { headers: { "content-type": "image/png" } })
  );
  await expect(
    resolveOwnedModelUploads(messages(), scope, signal)
  ).rejects.toMatchObject({ statusCode: 400 });
  expect(cancel).toHaveBeenCalledOnce();
  expect(body.locked).toBe(false);
});
test("same owned upload across selected history is verified and fetched once", async () => {
  vi.mocked(fetch).mockResolvedValue(
    new Response(new Uint8Array([1]), {
      headers: { "content-type": "image/png" },
    })
  );
  await resolveOwnedModelUploads(
    [...messages(), { ...messages()[0], id: "second" }],
    scope,
    signal
  );
  expect(state.verify).toHaveBeenCalledOnce();
  expect(fetch).toHaveBeenCalledOnce();
});
test("text-only context keeps normal model input and performs no upload work", async () => {
  const original: ChatMessage[] = [
    { id: "text", role: "user", parts: [{ type: "text", text: "normal" }] },
  ];
  expect(await resolveOwnedModelUploads(original, scope, signal)).toBe(
    original
  );
  expect(state.verify).not.toHaveBeenCalled();
  expect(fetch).not.toHaveBeenCalled();
});
