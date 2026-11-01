import { describe, it, expect, jest, afterEach } from "@jest/globals";
import {
  createReferenceMaintenanceTransport,
  runReferenceMaintenance,
  maintenancePaths,
} from "../../src/utils/reference-lifecycle";
const hash = "a".repeat(64),
  status = (state = "ready", complete = false) => ({
    version: 1,
    state,
    ready: state === "ready",
    generation: "gen",
    writerManifestHash: hash,
    expectedWriterManifestHash: hash,
    backfill: { complete },
    validation: { complete },
  });
const response = (value: unknown) =>
  new Response(JSON.stringify({ status: "success", value }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
function transport(values: unknown[]) {
  const calls: Array<{
    url: string;
    body: Record<string, unknown>;
    authorization: string | null;
  }> = [];
  const f = jest.fn(async (u: unknown, o?: RequestInit) => {
    calls.push({
      url: String(u),
      body: JSON.parse(String(o?.body)),
      authorization: new Headers(o?.headers).get("Authorization"),
    });
    if (!values.length) throw new Error("unexpected extra request");
    const v = values.shift();
    return v instanceof Response ? v : response(v);
  });
  return {
    t: createReferenceMaintenanceTransport(
      "http://127.0.0.1:45810",
      "owned-fixture-key",
      f as typeof fetch,
    ),
    calls,
    f,
  };
}
afterEach(() => jest.useRealTimers());
describe("separate explicit bounded reference administration transport", () => {
  it("has exactly8 fixed paths and references performs a query only", async () => {
    expect(Object.keys(maintenancePaths)).toHaveLength(8);
    const { t, calls } = transport([status()]);
    expect((await runReferenceMaintenance(t, "references", false)).ready).toBe(
      true,
    );
    expect(calls.map((x) => [x.url, x.body.path])).toEqual([
      ["http://127.0.0.1:45810/api/query", "referenceMaintenance:status"],
    ]);
    expect(calls[0].authorization).toBe("Convex owned-fixture-key");
  });
  it.each([
    "ftp://example.com",
    "http://user:password@example.com",
    "http://example.com/path",
    "http://example.com/?key=secret",
  ])("refuses invalid target before IO %s", (u) => {
    expect(() => createReferenceMaintenanceTransport(u, "key")).toThrow(
      "REFERENCE_INVALID_TARGET",
    );
  });
  it.each(["", "\nsecret", "secret\0"])(
    "requires explicit valid key %p",
    (key) => {
      expect(() =>
        createReferenceMaintenanceTransport("http://127.0.0.1:45810", key),
      ).toThrow("REFERENCE_DEPLOYMENT_KEY_REQUIRED");
    },
  );
  it("refuses arbitrary operation/table/ready flags and malformed cursor before any request", async () => {
    const { t, f } = transport([]);
    for (const [operation, args] of [
      ["arbitrary", {}],
      ["startGeneration", { ready: true }],
      ["planPage", { table: "users" }],
      ["planPage", { cursor: true }],
    ] as const)
      await expect(t.call(operation as never, args as never)).rejects.toThrow(
        /REFERENCE_OPERATION_NOT_ALLOWED|REFERENCE_ARGUMENT_NOT_ALLOWED/,
      );
    expect(f).not.toHaveBeenCalled();
  });
  it("dry-run paginates read-only queries with exact counts and no writes", async () => {
    const { t, calls } = transport([
      status("building"),
      {
        version: 1,
        executed: false,
        table: "artifacts",
        rows: 128,
        storageOccurrences: 2,
        done: false,
        nextCursor: "next",
      },
      {
        version: 1,
        executed: false,
        table: "artifacts",
        rows: 1,
        storageOccurrences: 3,
        done: true,
        nextCursor: null,
      },
    ]);
    const r = await runReferenceMaintenance(t, "migrate", true);
    expect(r).toMatchObject({
      executed: false,
      ready: false,
      plan: { artifacts: { rows: 129, storageOccurrences: 5 } },
    });
    expect(calls.every((c) => c.url.endsWith("/api/query"))).toBe(true);
  });
  it("refuses repeated cursor instead of reporting truncated planning success", async () => {
    const page = {
      version: 1,
      executed: false,
      table: "artifacts",
      rows: 0,
      storageOccurrences: 0,
      done: false,
      nextCursor: "same",
    };
    const { t } = transport([status("building"), page, page]);
    await expect(runReferenceMaintenance(t, "migrate", true)).rejects.toThrow(
      "REFERENCE_CURSOR_NONPROGRESS",
    );
  });
  it("follows server progress until final validated activation and never accepts caller completion", async () => {
    const { t, calls } = transport([
      status("missing"),
      {},
      status("building"),
      {},
      status("building", true),
      {},
      status("finalizing"),
      {},
      status("finalizing", true),
      {},
      status(),
    ]);
    const r = await runReferenceMaintenance(t, "migrate", false);
    expect(r.executed).toBe(true);
    expect(
      calls
        .filter((c) => c.url.endsWith("/api/mutation"))
        .map((c) => c.body.path),
    ).toEqual([
      "referenceMaintenance:startGeneration",
      "referenceMaintenance:advanceBackfill",
      "referenceMaintenance:beginFinalization",
      "referenceMaintenance:advanceValidation",
      "referenceMaintenance:activateGeneration",
    ]);
  });
  it("already-ready migration sends no mutation", async () => {
    const { t, calls } = transport([status()]);
    expect((await runReferenceMaintenance(t, "migrate", false)).executed).toBe(
      false,
    );
    expect(calls).toHaveLength(1);
  });
  it("never prints key or server raw content on genuine HTTP denial", async () => {
    const { t } = transport([
      new Response("secret fixture body", { status: 401 }),
    ]);
    await expect(t.status()).rejects.toThrow("REFERENCE_ACCESS_DENIED");
  });
  it("gives actionable deploy prerequisite for an absent fixed function", async () => {
    const { t } = transport([
      new Response(
        JSON.stringify({
          status: "error",
          errorMessage: "Could not find referenceMaintenance:status",
        }),
        { status: 400 },
      ),
    ]);
    await expect(t.status()).rejects.toThrow("REFERENCE_PREREQUISITE");
  });
  it("rejects inconsistent readiness/hash rather than certifying completion", async () => {
    const { t } = transport([
      { ...status(), writerManifestHash: "b".repeat(64) },
    ]);
    await expect(t.status()).rejects.toThrow("REFERENCE_PROTOCOL");
  });
  it("bounded mutation cancellation is unknown and is never resent", async () => {
    const controller = new AbortController();
    let calls = 0;
    const fetcher = async (_u: unknown, o?: RequestInit) => {
      calls++;
      return new Promise<Response>((_resolve, reject) => {
        o?.signal?.addEventListener(
          "abort",
          () => reject(new Error("aborted")),
          { once: true },
        );
      });
    };
    const t = createReferenceMaintenanceTransport(
      "http://127.0.0.1:45810",
      "key",
      fetcher as typeof fetch,
    );
    const promise = t.call("advanceBackfill", {}, controller.signal);
    controller.abort();
    await expect(promise).rejects.toMatchObject({
      code: "REFERENCE_CANCELLED",
      outcomeUnknown: true,
    });
    expect(calls).toBe(1);
  });
  it("finite request deadline clears its timer after rejection", async () => {
    jest.useFakeTimers();
    const fetcher = async (_u: unknown, o?: RequestInit) =>
      new Promise<Response>((_resolve, reject) =>
        o?.signal?.addEventListener(
          "abort",
          () => reject(new Error("deadline")),
          { once: true },
        ),
      );
    const t = createReferenceMaintenanceTransport(
      "http://127.0.0.1:45810",
      "key",
      fetcher as typeof fetch,
    );
    const promise = t.call("advanceBackfill");
    const expected = expect(promise).rejects.toMatchObject({
      code: "REFERENCE_REQUEST_TIMEOUT",
      outcomeUnknown: true,
    });
    await jest.advanceTimersByTimeAsync(10000);
    await expected;
    expect(jest.getTimerCount()).toBe(0);
  });
});
