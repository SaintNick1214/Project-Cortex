import { test, expect, vi, beforeEach, afterEach } from "vitest";
import {
  privateCall,
  initializePrivateTransport,
  privateConfiguration,
} from "../../lib/private-backend";
import { privateRequest } from "../../lib/private-request";
const mock = vi.hoisted(() => ({
  admin: vi.fn(),
  operation: vi.fn(),
  options: null as any,
}));
vi.mock("convex/browser", () => ({
  ConvexHttpClient: class {
    setAdminAuth = mock.admin;
    function = mock.operation;
    constructor(_url: string, options: any) {
      mock.options = options;
    }
  },
}));
beforeEach(() => {
  vi.clearAllMocks();
  Object.assign(process.env, {
    CONVEX_URL: "http://127.0.0.1:3218",
    CORTEX_APP_DEPLOYMENT_ADMIN_KEY: "unit-key",
    CORTEX_APP_TENANT_ID: "tenant",
    CORTEX_APP_ORIGIN: "http://127.0.0.1:3219",
  });
  mock.operation.mockResolvedValue(null);
});
afterEach(() => vi.useRealTimers());
test("fixed internal HTTP operation uses admin before query and keeps credentials out of output", async () => {
  expect(
    await privateCall("app/chatUsers:credentialByEmail", { email: "" }),
  ).toBeNull();
  expect(mock.admin).toHaveBeenCalledExactlyOnceWith("unit-key");
  expect(mock.operation).toHaveBeenCalledExactlyOnceWith(
    "app/chatUsers:credentialByEmail",
    undefined,
    { email: "" },
  );
  expect(mock.admin.mock.invocationCallOrder[0]).toBeLessThan(
    mock.operation.mock.invocationCallOrder[0],
  );
  expect(mock.options.logger).toBe(false);
});
test("unknown operation, missing/unsafe backend and unsupported transport refuse before calls", async () => {
  await expect(privateCall("memories:store" as any, {})).rejects.toMatchObject({
    statusCode: 400,
  });
  delete process.env.CORTEX_APP_DEPLOYMENT_ADMIN_KEY;
  expect(() => privateConfiguration()).toThrow();
  expect(mock.admin).not.toHaveBeenCalled();
  process.env.CORTEX_APP_DEPLOYMENT_ADMIN_KEY = "unit-key";
  process.env.CONVEX_URL = "http://remote.invalid";
  expect(() => privateConfiguration()).toThrow();
  process.env.CONVEX_URL = "http://127.0.0.1:3218";
  expect(() => initializePrivateTransport({})).toThrow();
  expect(mock.operation).not.toHaveBeenCalled();
});
test("wrong credentials produce bounded opaque gateway response, not the raw secret-bearing error", async () => {
  mock.operation.mockRejectedValue(new Error("unit-key: wrong deployment"));
  const response = await privateRequest(
    new Request("http://127.0.0.1:3219/api/private"),
    async () => {
      await privateCall("app/chatUsers:credentialByEmail", { email: "" });
      return new Response();
    },
  );
  expect(response.status).toBe(503);
  expect(await response.text()).not.toContain("unit-key");
});
test("HTTP request receives a real finite abort signal before transport", async () => {
  globalThis.fetch = vi.fn(async (_url, options) => {
    expect(options?.signal?.aborted).toBe(false);
    return new Response();
  });
  await privateCall("app/chatUsers:credentialByEmail", { email: "" });
  await mock.options.fetch("http://127.0.0.1:3218/api/function", {});
  const signal = vi.mocked(fetch).mock.calls[0][1]?.signal;
  if (!signal) throw new Error("Private request must provide its owned abort signal");
  await new Promise<void>((resolve) =>
    signal.addEventListener("abort", () => resolve(), { once: true }),
  );
  expect(signal.aborted).toBe(true);
}, 10000);
test("cross-origin mutation and missing origin configuration stop before backend work; same origin and read are allowed", async () => {
  const work = vi.fn(async () => new Response("ok"));
  const post = (origin: string) =>
    new Request("http://127.0.0.1:3219/api/private", {
      method: "POST",
      headers: { origin },
    });
  expect(
    (await privateRequest(post("https://foreign.invalid"), work)).status,
  ).toBe(403);
  expect(work).not.toHaveBeenCalled();
  delete process.env.CORTEX_APP_ORIGIN;
  expect(
    (await privateRequest(post("http://127.0.0.1:3219"), work)).status,
  ).toBe(503);
  expect(work).not.toHaveBeenCalled();
  process.env.CORTEX_APP_ORIGIN = "http://127.0.0.1:3219";
  expect(
    (await privateRequest(post("http://127.0.0.1:3219"), work)).status,
  ).toBe(200);
  expect(
    (
      await privateRequest(
        new Request("http://127.0.0.1:3219/api/private"),
        work,
      )
    ).status,
  ).toBe(200);
});
