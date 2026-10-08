import { test, expect, vi, beforeEach, afterEach } from "vitest";
import { auth } from "@/app/(auth)/auth";
import type { Session } from "next-auth";
// This test exercises the no-argument session overload, not the route-handler overload.
const sessionAuth = vi.mocked(auth as () => Promise<Session | null>);
import {
  createScopedCortex,
  withCortex,
  requireScope,
  closeOwnedCortex,
  getMemorySpaceId,
  getAgentId,
  assertChatOwner,
  assertArtifactOwner,
} from "../../lib/cortex";
const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  close: vi.fn(),
  shutdown: vi.fn(),
  call: vi.fn(),
  connect: vi.fn(),
  disconnect: vi.fn(),
  resolveGraph: vi.fn(),
}));
vi.mock("@cortexmemory/sdk", () => ({
  Cortex: { create: mocks.create },
  resolveGraphConnection: mocks.resolveGraph,
  CypherGraphAdapter: class {
    connect = mocks.connect;
    disconnect = mocks.disconnect;
  },
}));
vi.mock("../../lib/private-backend", () => ({
  privateCall: mocks.call,
  privateConfiguration: () => {
    if (!process.env.CONVEX_URL || !process.env.CORTEX_APP_DEPLOYMENT_ADMIN_KEY)
      throw new Error("Configure private backend");
    return {
      convexUrl: process.env.CONVEX_URL,
      tenantId: "tenant",
      deploymentKey: process.env.CORTEX_APP_DEPLOYMENT_ADMIN_KEY,
    };
  },
  initializePrivateTransport: (client: any) => {
    client.setAdminAuth(process.env.CORTEX_APP_DEPLOYMENT_ADMIN_KEY);
    return undefined;
  },
}));
const scope = { userId: "owner", tenantId: "tenant", memorySpaceId: "owned" };
beforeEach(() => {
  vi.clearAllMocks();
  sessionAuth.mockResolvedValue({ user: { id: "owner" } } as any);
  mocks.call.mockResolvedValue(null);
  mocks.shutdown.mockResolvedValue(undefined);
  mocks.connect.mockResolvedValue(undefined);
  mocks.disconnect.mockResolvedValue(undefined);
  mocks.resolveGraph.mockReturnValue({ uri: "bolt://unit.invalid", username: "unit", password: "unit-only" });
  mocks.create.mockImplementation(async (config, runtime) => {
    const setAdminAuth = vi.fn();
    runtime.initializeTransport({ setAdminAuth });
    return {
      config,
      setAdminAuth,
      close: mocks.close,
      shutdown: mocks.shutdown,
    };
  });
});
afterEach(() => vi.useRealTimers());
test("verified session fixes tenant and user-owned space", async () => {
  Reflect.deleteProperty(process.env, "MEMORY_SPACE_ID");
  expect(await requireScope("owner")).toEqual({
    userId: "owner",
    tenantId: "tenant",
    memorySpaceId: "chat-sdk-demo-owner",
  });
});
test("no session and caller-selected identity refuse before any operation", async () => {
  sessionAuth.mockResolvedValue(null);
  await expect(requireScope()).rejects.toMatchObject({ statusCode: 401 });
  sessionAuth.mockResolvedValue({ user: { id: "owner" } } as any);
  await expect(requireScope("foreign")).rejects.toMatchObject({
    statusCode: 403,
  });
  expect(mocks.create).not.toHaveBeenCalled();
  expect(mocks.call).not.toHaveBeenCalled();
});
test("private HTTP preflight precedes SDK initialization and applies admin once", async () => {
  const client: any = await createScopedCortex(scope);
  expect(mocks.call).toHaveBeenCalledWith("app/chatUsers:credentialByEmail", {
    email: "",
  });
  expect(client.config).toEqual({
    convexUrl: "http://127.0.0.1:3218",
    auth: { userId: "owner", tenantId: "tenant" },
    graphEnabled: false,
  });
  expect(client.setAdminAuth).toHaveBeenCalledExactlyOnceWith(
    "unit-private-key"
  );
  expect(mocks.call.mock.invocationCallOrder[0]).toBeLessThan(
    mocks.create.mock.invocationCallOrder[0]
  );
});
test("ordinary refusal prevents WebSocket construction", async () => {
  mocks.call.mockRejectedValue(new Error("credential refused"));
  await expect(createScopedCortex(scope)).rejects.toThrow("credential refused");
  expect(mocks.create).not.toHaveBeenCalled();
});
test("each request owns a new SDK, completes work and awaits shutdown", async () => {
  let done: (() => void) | undefined;
  mocks.shutdown.mockImplementation(
    () =>
      new Promise<void>((resolve) => {
        done = resolve;
      })
  );
  let settled = false;
  const operation = withCortex(scope, async () => "result").then((value) => {
    settled = true;
    return value;
  });
  await vi.waitFor(() => expect(mocks.close).toHaveBeenCalled());
  expect(settled).toBe(false);
  done!();
  expect(await operation).toBe("result");
  mocks.shutdown.mockResolvedValue(undefined);
  await withCortex(scope, async () => "second");
  expect(mocks.create).toHaveBeenCalledTimes(2);
});
test("work rejection initiates close and awaits shutdown", async () => {
  await expect(
    withCortex(scope, async () => {
      throw new Error("work failed");
    })
  ).rejects.toThrow("work failed");
  expect(mocks.close).toHaveBeenCalledTimes(1);
  expect(mocks.shutdown).toHaveBeenCalledTimes(1);
});
test("explicit graph mutation mode reaches the owned SDK and still joins cleanup", async () => {
  await withCortex(scope, async () => "mutation", true);
  expect(mocks.create.mock.calls[0][0].graphEnabled).toBe(true);
  expect(mocks.create.mock.calls[0][0].graph).toMatchObject({ autoSync: false });
  expect(mocks.create.mock.calls[0][0].graph.adapter.connect).toBe(mocks.connect);
  expect(mocks.connect).toHaveBeenCalledOnce();
  expect(mocks.resolveGraph).toHaveBeenCalledExactlyOnceWith({ enabled: true });
  expect(mocks.disconnect).toHaveBeenCalledOnce();
  expect(mocks.shutdown.mock.invocationCallOrder[0]).toBeLessThan(mocks.disconnect.mock.invocationCallOrder[0]);
  expect(mocks.close).toHaveBeenCalledOnce();
  expect(mocks.shutdown).toHaveBeenCalledOnce();
  await withCortex(scope, async () => "read");
  expect(mocks.create.mock.calls[1][0].graphEnabled).toBe(false);
});
test("pending operation times out; teardown initiates; cleanup unknown is honest", async () => {
  vi.useFakeTimers();
  mocks.shutdown.mockResolvedValue(undefined);
  const result = withCortex(scope, () => new Promise<never>(() => {}));
  const observed = expect(result).rejects.toMatchObject({ statusCode: 503 });
  await vi.advanceTimersByTimeAsync(30001);
  await observed;
  expect(mocks.close).toHaveBeenCalledTimes(1);
  mocks.shutdown.mockImplementation(() => new Promise<never>(() => {}));
  const cleanup = closeOwnedCortex({
    close: mocks.close,
    shutdown: mocks.shutdown,
  } as any);
  const failed = expect(cleanup).rejects.toMatchObject({
    cause: "Backend cleanup did not finish",
  });
  await vi.advanceTimersByTimeAsync(30001);
  await failed;
});
test("scope validators reject foreign tenant/user/space and missing resource", () => {
  const conversation = {
    participants: { userId: "owner" },
    tenantId: "tenant",
    memorySpaceId: "owned",
  };
  expect(() => assertChatOwner(conversation as any, scope)).not.toThrow();
  for (const forged of [
    null,
    { ...conversation, tenantId: "foreign" },
    { ...conversation, participants: { userId: "foreign" } },
    { ...conversation, memorySpaceId: "foreign" },
  ])
    expect(() => assertChatOwner(forged as any, scope)).toThrow();
  const artifact = { ...scope };
  expect(() => assertArtifactOwner(artifact as any, scope)).not.toThrow();
  expect(() =>
    assertArtifactOwner({ ...artifact, userId: "foreign" } as any, scope)
  ).toThrow();
});
test("space environment base always retains verified owner suffix", () => {
  process.env.MEMORY_SPACE_ID = "custom";
  expect(getMemorySpaceId("owner")).toBe("custom-owner");
  delete process.env.MEMORY_SPACE_ID;
  expect(getMemorySpaceId("owner")).toBe("chat-sdk-demo-owner");
  expect(() => getMemorySpaceId("")).toThrow();
});
test("agent environment/default behavior retained", () => {
  process.env.AGENT_ID = "custom";
  expect(getAgentId()).toBe("custom");
  delete process.env.AGENT_ID;
  expect(getAgentId()).toBe("chat-assistant");
  process.env.AGENT_ID = "";
  expect(getAgentId()).toBe("chat-assistant");
});

test("per-user spaces remain distinct and satisfy the real SDK identifier contract", () => {
  process.env.MEMORY_SPACE_ID = "chat-native";
  const first = getMemorySpaceId("0c6ac674-6100-42fb-a898-c1d877aa8610");
  const second = getMemorySpaceId("2697f11a-8c7b-44c6-af54-f88886a8513c");
  expect(first).toBe("chat-native-0c6ac674-6100-42fb-a898-c1d877aa8610");
  expect(first).toMatch(/^[A-Za-z0-9_-]+$/);
  expect(second).toMatch(/^[A-Za-z0-9_-]+$/);
  expect(first).not.toBe(second);
  Reflect.deleteProperty(process.env, "MEMORY_SPACE_ID");
});

test("graph construction and connection failures disconnect the owned adapter without running work", async () => {
  mocks.create.mockRejectedValueOnce(new Error("construction failed"));
  await expect(createScopedCortex(scope, true)).rejects.toThrow("construction failed");
  expect(mocks.disconnect).toHaveBeenCalledOnce();
  mocks.disconnect.mockClear();
  mocks.create.mockClear();
  mocks.connect.mockRejectedValueOnce(new Error("connection failed"));
  await expect(createScopedCortex(scope, true)).rejects.toThrow("connection failed");
  expect(mocks.create).not.toHaveBeenCalled();
  expect(mocks.disconnect).toHaveBeenCalledOnce();
});
test("graph-off read does not select, construct or close a graph adapter", async () => {
  await withCortex(scope, async () => "read");
  expect(mocks.resolveGraph).not.toHaveBeenCalled();
  expect(mocks.connect).not.toHaveBeenCalled();
  expect(mocks.disconnect).not.toHaveBeenCalled();
});
test("graph work failure still awaits SDK shutdown and owned adapter disconnect", async () => {
  await expect(withCortex(scope, async () => { throw new Error("work failed"); }, true)).rejects.toThrow("work failed");
  expect(mocks.shutdown).toHaveBeenCalledOnce();
  expect(mocks.disconnect).toHaveBeenCalledOnce();
});
