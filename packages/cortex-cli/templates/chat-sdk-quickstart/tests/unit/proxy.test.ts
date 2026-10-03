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
  it("redirects registered users away from login", async () => {
    getToken.mockResolvedValue({ email: "user@example.com", type: "regular" });
    const response = await proxy(request("/login"));
    expect(response.headers.get("Location")).toBe("http://127.0.0.1:3000/");
  });
});
