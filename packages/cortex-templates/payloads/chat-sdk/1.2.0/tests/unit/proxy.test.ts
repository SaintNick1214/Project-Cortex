// @vitest-environment node

import type { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { proxy } from "../../proxy";

const { getToken, next, redirect } = vi.hoisted(() => ({
  getToken: vi.fn(),
  next: vi.fn(() => new Response(null, { status: 200 })),
  redirect: vi.fn(
    (url: URL) =>
      new Response(null, { headers: { Location: url.href }, status: 307 })
  ),
}));
vi.mock("next-auth/jwt", () => ({ getToken }));
vi.mock("next/server", () => ({ NextResponse: { next, redirect } }));

function request(path: string): NextRequest {
  const url = new URL(path, "http://127.0.0.1:3000");
  return {
    headers: new Headers(),
    nextUrl: url,
    url: url.href,
  } as unknown as NextRequest;
}

describe("authentication routing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
  });
  it.each(["/login", "/register"])(
    "lets unauthenticated visitors open %s",
    async (path) => {
      getToken.mockResolvedValue(null);
      expect((await proxy(request(path))).status).toBe(200);
      expect(redirect).not.toHaveBeenCalled();
    }
  );
  it("lets guests open login using their session type", async () => {
    getToken.mockResolvedValue({
      email: "guest-guest-123-random@example.com",
      type: "guest",
    });
    expect((await proxy(request("/login"))).status).toBe(200);
  });
  it("refuses anonymous API calls without creating a guest session", async () => {
    getToken.mockResolvedValue(null);
    const response = await proxy(request("/api/history"));
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "Unauthorized" });
    expect(redirect).not.toHaveBeenCalled();
  });
  it("leaves public share and Auth.js routes to their protected handlers", async () => {
    expect((await proxy(request("/share/opaque-share"))).status).toBe(200);
    expect((await proxy(request("/api/auth/session"))).status).toBe(200);
    expect(getToken).not.toHaveBeenCalled();
  });
  it("uses the configured HTTPS cookie prefix even with an HTTP request hint", async () => {
    vi.stubEnv("AUTH_URL", "https://configured.example");
    getToken.mockResolvedValue(null);
    await proxy(request("/login"));
    expect(getToken).toHaveBeenCalledWith(
      expect.objectContaining({ secureCookie: true })
    );
  });
  it("uses ordinary cookies for an explicitly configured local HTTP origin", async () => {
    vi.stubEnv("AUTH_URL", "http://localhost:3000");
    getToken.mockResolvedValue(null);
    await proxy(request("/login"));
    expect(getToken).toHaveBeenCalledWith(
      expect.objectContaining({ secureCookie: false })
    );
  });
  it("redirects registered users away from login", async () => {
    getToken.mockResolvedValue({ email: "user@example.com", type: "regular" });
    const response = await proxy(request("/login"));
    expect(response.headers.get("Location")).toBe("http://127.0.0.1:3000/");
  });
});
