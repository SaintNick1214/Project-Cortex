/** Handler integration against the private cookie gateway (no real network). */
import { createHash } from "node:crypto";
import { hashPassword, verifyPassword } from "../../lib/password";
import { GET as checkGet } from "../../app/api/auth/check/route";
import { POST as setupPost } from "../../app/api/auth/setup/route";
import { POST as registerPost } from "../../app/api/auth/register/route";
import { POST as loginPost } from "../../app/api/auth/login/route";
const mockCalls: Array<[string, any]> = [];
const mockAccounts = new Map<string, any>();
const mockSessions = new Map<string, string>();
let mockSetup = false,
  mockRefusal = false;
jest.mock("convex/browser", () => ({
  ConvexHttpClient: class {
    setAdminAuth(key: string) {
      if (key !== "unit-private-key") throw new Error("refused");
    }
    async function(name: string, _: undefined, args: any) {
      mockCalls.push([name, args]);
      if (mockRefusal) throw new Error("private diagnostic");
      if (name === "app/authState:status") return { isSetup: mockSetup };
      if (name === "app/accounts:credentialByUsername")
        return mockAccounts.get(args.username) ?? null;
      if (name === "app/accounts:identityById")
        return (
          [...mockAccounts.values()].find(
            (a) => a.accountId === args.accountId
          ) ?? null
        );
      if (name === "app/accounts:setup" || name === "app/accounts:register") {
        if (name.endsWith(":setup") && mockSetup)
          return { error: "SETUP_COMPLETE" };
        if (mockAccounts.has(args.username)) return { error: "USERNAME_TAKEN" };
        mockSetup = true;
        mockAccounts.set(args.username, {
          ...args,
          tenantId: "tenant",
          allowedMemorySpaceIds: ["owned"],
          role: name.endsWith(":setup") ? "admin" : "user",
          disabled: false,
        });
        return { accountId: args.accountId };
      }
      if (name === "app/sessions:create") {
        mockSessions.set(args.sessionDigest, args.accountId);
        return null;
      }
      if (name === "app/sessions:resolve")
        return (
          [...mockAccounts.values()].find(
            (a) => a.accountId === mockSessions.get(args.sessionDigest)
          ) ?? null
        );
      throw new Error("Unexpected private operation");
    }
  },
}));
const request = (body: unknown, origin = "https://unit.invalid") =>
  new Request("https://unit.invalid/api/auth/login", {
    method: "POST",
    headers: { origin, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
const valid = { username: "testuser", password: "password123" };
const read = () => new Request("https://unit.invalid/api/auth/check");
async function seed(passwordHash?: string) {
  mockAccounts.set("testuser", {
    accountId: "owner",
    username: "testuser",
    passwordHash: passwordHash ?? (await hashPassword(valid.password)),
    role: "user",
    tenantId: "tenant",
    allowedMemorySpaceIds: ["owned"],
    disabled: false,
  });
}
async function assertCookie(response: Response) {
  expect(response.status).toBe(200);
  const body = await response.json();
  expect(body.success).toBe(true);
  expect(body.sessionToken).toBeUndefined();
  const cookie = response.headers.get("set-cookie")!;
  expect(cookie).toMatch(
    /^cortex-app-session=[a-f0-9]{64}; HttpOnly; SameSite=Lax; Path=\/; Max-Age=28800; Secure$/
  );
  const token = cookie.split(";")[0].split("=")[1];
  const digest = createHash("sha256").update(token).digest("hex");
  expect(mockSessions.has(digest)).toBe(true);
  expect(mockSessions.has(token)).toBe(false);
  const verified = await checkGet(
    new Request("https://unit.invalid/api/auth/check", {
      headers: { cookie: cookie.split(";")[0] },
    })
  );
  expect((await verified.json()).user).toEqual(body.user);
  return body;
}
beforeEach(() => {
  Object.assign(process.env, {
    CONVEX_URL: "http://127.0.0.1:3218",
    CORTEX_APP_DEPLOYMENT_ADMIN_KEY: "unit-private-key",
    CORTEX_APP_ORIGIN: "https://unit.invalid",
    CORTEX_APP_SETUP_TOKEN: "unit-setup",
  });
  mockAccounts.clear();
  mockSessions.clear();
  mockCalls.length = 0;
  mockSetup = false;
  mockRefusal = false;
});
describe("private Auth API routes", () => {
  test("status is false before setup", async () => {
    const r = await checkGet(read());
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ isSetup: false, user: null });
  });
  test("status is true after setup", async () => {
    mockSetup = true;
    expect((await (await checkGet(read())).json()).isSetup).toBe(true);
  });
  test("status uses only private authState operation", async () => {
    await checkGet(read());
    expect(mockCalls).toEqual([["app/authState:status", {}]]);
  });
  test.each([
    { password: "password123" },
    { username: "testuser" },
    { username: 123, password: "password123" },
    { username: "testuser", password: 123 },
    { username: "a", password: "password123" },
    { username: "testuser", password: "abc" },
    { username: "test user@!", password: "password123" },
    { username: "testuser", password: "x".repeat(1025) },
  ])("invalid credentials refuse before backend: %j", async (body) => {
    const r = await registerPost(request(body));
    expect(r.status).toBe(400);
    expect(mockCalls).toEqual([]);
  });
  test("setup requires configured capability", async () => {
    delete process.env.CORTEX_APP_SETUP_TOKEN;
    expect((await setupPost(request(valid))).status).toBe(503);
    expect(mockCalls).toEqual([]);
  });
  test("wrong setup capability refuses before backend", async () => {
    expect(
      (await setupPost(request({ ...valid, setupToken: "wrong" }))).status
    ).toBe(403);
    expect(mockCalls).toEqual([]);
  });
  test("existing setup returns conflict without issuing session", async () => {
    mockSetup = true;
    expect(
      (await setupPost(request({ ...valid, setupToken: "unit-setup" }))).status
    ).toBe(409);
    expect(mockSessions.size).toBe(0);
  });
  test("setup persists a private salted hash and verified cookie", async () => {
    await assertCookie(
      await setupPost(request({ ...valid, setupToken: "unit-setup" }))
    );
    const args = mockCalls.find(([n]) => n === "app/accounts:setup")![1];
    expect(args.passwordHash).not.toContain(valid.password);
    expect(await verifyPassword(valid.password, args.passwordHash)).toBe(true);
    expect(args.tenantId).toMatch(/^tenant-/);
  });
  test("duplicate registration is conflict", async () => {
    await seed();
    expect((await registerPost(request(valid))).status).toBe(409);
    expect(mockSessions.size).toBe(0);
  });
  test("registration normalizes username and preserves display name", async () => {
    const b = await assertCookie(
      await registerPost(
        request({
          ...valid,
          username: " TestUser ",
          displayName: " Test Display ",
        })
      )
    );
    expect(b.user.displayName).toBe("Test Display");
    expect(mockAccounts.get("testuser").username).toBe("testuser");
  });
  test("registration defaults display name and fixes private identity", async () => {
    const b = await assertCookie(await registerPost(request(valid)));
    expect(b.user.displayName).toBe("testuser");
    expect(b.user.id).toMatch(/^[a-f0-9-]{36}$/);
    expect(b.user.allowedMemorySpaceIds).toEqual(["owned"]);
  });
  test("username underscores and hyphens remain supported", async () => {
    const b = await assertCookie(
      await registerPost(request({ ...valid, username: "test_user-123" }))
    );
    expect(b.user.displayName).toBe("test_user-123");
  });
  test.each([
    "absent",
    "wrong",
    "missing-hash",
    "disabled",
  ])("login %s refuses without session", async (mode) => {
    await seed();
    const a = mockAccounts.get("testuser");
    if (mode === "missing-hash") delete a.passwordHash;
    if (mode === "disabled") a.disabled = true;
    const r = await loginPost(
      request({
        username: mode === "absent" ? "absent" : "testuser",
        password: mode === "wrong" ? "wrongpass" : valid.password,
      })
    );
    expect(r.status).toBe(401);
    expect(await r.json()).toEqual({ error: "Invalid username or password" });
    expect(mockSessions.size).toBe(0);
  });
  test("valid login normalizes lookup and issues a verified session", async () => {
    await seed();
    const b = await assertCookie(
      await loginPost(request({ ...valid, username: "TestUser" }))
    );
    expect(b.user).toEqual({
      id: "owner",
      displayName: "testuser",
      allowedMemorySpaceIds: ["owned"],
    });
  });
  test("cross-origin authentication refuses before backend", async () => {
    expect(
      (await loginPost(request(valid, "https://foreign.invalid"))).status
    ).toBe(403);
    expect(mockCalls).toEqual([]);
  });
  test("backend refusal is opaque and creates no session", async () => {
    mockRefusal = true;
    const r = await loginPost(request(valid));
    expect(r.status).toBe(503);
    expect(await r.text()).not.toContain("private diagnostic");
    expect(mockSessions.size).toBe(0);
  });
});
