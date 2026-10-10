import {
  authenticate,
  resolveSession,
  logout,
  requireSession,
  selectSpace,
  errorResponse,
  privateConfiguration,
  type AppIdentity,
} from "../../lib/app-auth";
import { hashPassword } from "../../lib/password";
const mockCalls: Array<[string, unknown]> = [];
const identity: AppIdentity = {
  accountId: "owner",
  username: "alice",
  role: "user",
  tenantId: "tenant",
  allowedMemorySpaceIds: ["owned"],
};
let mockPassword = "";
let mockRefused = false;
const mockSessions = new Map<string, boolean>();
jest.mock("convex/browser", () => ({
  ConvexHttpClient: class {
    setAdminAuth(key: string) {
      if (key !== "unit-private-key") throw new Error("secret refusal");
    }
    async function(name: string, _: undefined, args: any) {
      mockCalls.push([name, args]);
      if (mockRefused) throw new Error("secret refusal");
      if (name === "app/accounts:credentialByUsername")
        return args.username === "alice"
          ? { accountId: "owner", passwordHash: mockPassword, disabled: false }
          : null;
      if (name === "app/accounts:identityById") return identity;
      if (name === "app/sessions:create") {
        mockSessions.set(args.sessionDigest, true);
        return null;
      }
      if (name === "app/sessions:resolve")
        return mockSessions.get(args.sessionDigest) ? identity : null;
      if (name === "app/sessions:revoke") {
        mockSessions.set(args.sessionDigest, false);
        return null;
      }
      if (name === "app/authState:status") return { isSetup: true };
      return { accountId: "owner" };
    }
  },
}));
const request = (
  body: object,
  origin = "http://127.0.0.1:3219",
  cookie?: string,
) =>
  new Request("http://127.0.0.1:3219/api/auth/login", {
    method: "POST",
    headers: {
      origin,
      "content-type": "application/json",
      ...(cookie ? { cookie } : {}),
    },
    body: JSON.stringify(body),
  });
beforeAll(async () => {
  mockPassword = await hashPassword("password");
});
beforeEach(() => {
  Object.assign(process.env, {
    NODE_ENV: "development",
    CONVEX_URL: "http://127.0.0.1:3218",
    CORTEX_APP_DEPLOYMENT_ADMIN_KEY: "unit-private-key",
    CORTEX_APP_ORIGIN: "http://127.0.0.1:3219",
    CORTEX_APP_SETUP_TOKEN: "unit-setup",
  });
  mockCalls.length = 0;
  mockRefused = false;
  mockSessions.clear();
});
test("login stores only a digest, cookie reload verifies authority, logout revokes first", async () => {
  const response = await authenticate(
    request({ username: "alice", password: "password" }),
    "login",
  );
  const body = await response.json();
  expect(body).toEqual({
    success: true,
    user: {
      id: "owner",
      displayName: "alice",
      allowedMemorySpaceIds: ["owned"],
    },
  });
  const cookie = response.headers.get("set-cookie")!;
  expect(cookie).toMatch(/HttpOnly; SameSite=Lax; Path=\/; Max-Age=28800/);
  const token = cookie.split(";")[0];
  expect(mockCalls[1][1]).not.toEqual(
    expect.objectContaining({ sessionToken: token }),
  );
  const read = new Request("http://127.0.0.1:3219/api/conversations", {
    headers: { cookie: token },
  });
  expect(await requireSession(read)).toEqual(identity);
  await logout(request({}, undefined, token));
  expect(await resolveSession(read)).toBeNull();
  expect(mockCalls.map((call) => call[0])).toContain("app/sessions:revoke");
});
test.each(["setup", "register"] as const)(
  "%s issues a verified cookie and fixes authority server side",
  async (mode) => {
    const response = await authenticate(
      request({
        username: "alice",
        password: "password",
        setupToken: "unit-setup",
      }),
      mode,
    );
    expect(response.status).toBe(200);
    const args = mockCalls.find(
      (call) => call[0] === `app/accounts:${mode}`,
    )![1] as any;
    expect(args).toMatchObject({ username: "alice" });
    expect(args.passwordHash).not.toContain("password");
    expect(args.role).toBeUndefined();
  },
);
test.each([
  { role: "admin" },
  { tenantId: "foreign" },
  { accountId: "foreign" },
  { allowedMemorySpaceIds: ["foreign"] },
])("forged registration authority refuses before backend", async (forged) => {
  await expect(
    authenticate(
      request({ username: "alice", password: "password", ...forged }),
      "register",
    ),
  ).rejects.toMatchObject({ status: 400 });
  expect(mockCalls).toEqual([]);
});
test("wrong setup capability and cross-origin calls refuse before effects", async () => {
  await expect(
    authenticate(
      request({ username: "alice", password: "password", setupToken: "wrong" }),
      "setup",
    ),
  ).rejects.toMatchObject({ status: 403 });
  await expect(
    authenticate(
      request(
        { username: "alice", password: "password" },
        "https://foreign.invalid",
      ),
      "login",
    ),
  ).rejects.toMatchObject({ status: 403 });
  expect(mockCalls).toEqual([]);
});
test.each(["absent", "wrong"])(
  "%s credential does not create session",
  async (username) => {
    await expect(
      authenticate(request({ username, password: "password" }), "login"),
    ).rejects.toMatchObject({ status: 401 });
    expect(mockCalls.map((call) => call[0])).toEqual([
      "app/accounts:credentialByUsername",
    ]);
  },
);
test("no cookie or forged local storage style token has no authority", async () => {
  await expect(
    requireSession(new Request("http://127.0.0.1:3219/data")),
  ).rejects.toMatchObject({ status: 401 });
  expect(
    await resolveSession(
      new Request("http://127.0.0.1:3219/data", {
        headers: { cookie: 'cortex-app-session={"userId":"owner"}' },
      }),
    ),
  ).toBeNull();
  expect(mockCalls).toEqual([]);
});
test.each([
  { userId: "foreign" },
  { tenantId: "foreign" },
  { memorySpaceId: "foreign" },
])("forged data scope refuses", (selectors) =>
  expect(() => selectSpace(identity, selectors)).toThrow(
    "scope" in selectors ? "Account" : undefined,
  ),
);
test("selected authorized memory space and missing configuration", () => {
  expect(selectSpace(identity, {})).toBe("owned");
  delete process.env.CORTEX_APP_DEPLOYMENT_ADMIN_KEY;
  expect(() => privateConfiguration()).toThrow("Configure");
});
test("credential refusal is bounded opaque and failed logout preserves cookie", async () => {
  const signed = await authenticate(
    request({ username: "alice", password: "password" }),
    "login",
  );
  mockRefused = true;
  const error = await logout(
    request({}, undefined, signed.headers.get("set-cookie")!.split(";")[0]),
  ).catch((error) => error);
  const response = errorResponse(error);
  expect(response.status).toBe(503);
  expect(await response.text()).not.toContain("secret refusal");
  expect(response.headers.get("set-cookie")).toBeNull();
});

test("registration preserves bounded display name without granting authority", async () => {
  await authenticate(
    request({
      username: "alice",
      password: "password",
      displayName: " Alice Example ",
    }),
    "register",
  );
  expect(
    mockCalls.find(([name]) => name === "app/accounts:register")?.[1],
  ).toMatchObject({ username: "alice", displayName: "Alice Example" });
  const before = mockCalls.length;
  await expect(
    authenticate(
      request({
        username: "alice",
        password: "password",
        displayName: "x".repeat(101),
      }),
      "register",
    ),
  ).rejects.toMatchObject({ status: 400 });
  expect(mockCalls).toHaveLength(before);
});
