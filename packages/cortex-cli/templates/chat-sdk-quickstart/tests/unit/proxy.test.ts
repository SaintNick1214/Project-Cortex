// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const { next } = vi.hoisted(() => ({
  next: vi.fn(() => new Response(null, { status: 200 })),
}));
vi.mock("next/server", () => ({ NextResponse: { next } }));

import { proxy } from "../../proxy";

describe("host identity routing", () => {
  beforeEach(() => vi.clearAllMocks());
  it.each(["/", "/chat/one", "/login", "/api/document"])(
    "leaves %s to fresh backend authorization without fabricating guest identity",
    () => {
      expect(proxy().status).toBe(200);
      expect(next).toHaveBeenCalledOnce();
    }
  );
});
