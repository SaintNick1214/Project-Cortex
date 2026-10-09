import {
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  jest,
} from "@jest/globals";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import http from "node:http";
import type { Socket } from "node:net";
import { createProgram } from "../../program.js";
import { acquireForegroundSignalHandler } from "../client.js";
import {
  printFiniteLogs,
  readFiniteLogs,
  resolveNativeTarget,
  validateNativeLogPayload,
  type NativeLogEvent,
} from "../management.js";
import type { CLIConfig } from "../../types.js";

beforeAll(() => {
  if (
    !process.env.CORTEX_TEST_HOME_ROOT ||
    fs.realpathSync(os.homedir()) !==
      fs.realpathSync(process.env.CORTEX_TEST_HOME_ROOT)
  )
    throw new Error("Externally isolated HOME required before imports");
});
const roots: string[] = [],
  servers: http.Server[] = [];
const sockets = new Set<Socket>();
async function server(handler: http.RequestListener): Promise<{
  config: CLIConfig;
  requests: string[];
  headers: Array<string | undefined>;
}> {
  const requests: string[] = [],
    headers: Array<string | undefined> = [];
  const instance = http.createServer((req, res) => {
    requests.push(req.url!);
    headers.push(req.headers.authorization);
    handler(req, res);
  });
  instance.on("connection", (socket) => {
    sockets.add(socket);
    socket.once("close", () => sockets.delete(socket));
  });
  servers.push(instance);
  await new Promise<void>((resolve) =>
    instance.listen(0, "127.0.0.1", () => resolve()),
  );
  const address = instance.address();
  if (!address || typeof address === "string")
    throw new Error("Invalid test listener");
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "cortex-native-logs-"));
  roots.push(root);
  fs.mkdirSync(path.join(root, "node_modules/convex/bin"), { recursive: true });
  fs.writeFileSync(
    path.join(root, "node_modules/convex/package.json"),
    '{"name":"convex","version":"1.46.0","bin":"bin/main.js"}',
  );
  fs.writeFileSync(path.join(root, "node_modules/convex/bin/main.js"), "");
  fs.mkdirSync(path.join(root, ".convex/local/default"), { recursive: true });
  fs.writeFileSync(
    path.join(root, ".convex/local/default/config.json"),
    JSON.stringify({
      deploymentName: "anonymous-logs",
      adminKey: "local-test-key",
      ports: { cloud: address.port, site: 1 },
    }),
  );
  const config: CLIConfig = {
    deployments: {
      logs: {
        url: `http://127.0.0.1:${address.port}`,
        key: "local-test-key",
        deployment: "local:anonymous-logs",
        projectPath: root,
      },
    },
    default: "logs",
    format: "json",
    confirmDangerous: true,
  };
  return { config, requests, headers };
}
const event = (message = 'hello,"世界"\nline'): NativeLogEvent => ({
  kind: "Progress",
  udfType: "Action",
  identifier: "probe:work",
  timestamp: 123,
  logLines: [
    {
      messages: [message],
      level: "LOG",
      timestamp: 123,
      isTruncated: false,
      systemMetadata: null,
      componentPath: null,
      udfPath: null,
    },
  ],
  requestId: "r",
  executionId: "e",
  componentPath: null,
});
const send = (
  res: http.ServerResponse,
  entries: unknown[] = [],
  cursor = 123,
): void => {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify({ entries, newCursor: cursor }));
};
afterEach(async () => {
  jest.useRealTimers();
  jest.restoreAllMocks();
  process.exitCode = 0;
  for (const socket of sockets) socket.destroy();
  await Promise.all(
    servers
      .splice(0)
      .map(
        (instance) =>
          new Promise<void>((resolve) => instance.close(() => resolve())),
      ),
  );
  for (const root of roots.splice(0))
    fs.rmSync(root, { recursive: true, force: true });
});
describe("bounded internal native logs compatibility", () => {
  it("makes one exact selected admin read, last-N complete events and credential redaction", async () => {
    const fixture = await server((_req, res) =>
      send(res, [event("old"), event("new local-test-key")], 456),
    );
    const chunk = await readFiniteLogs(
      resolveNativeTarget(fixture.config, {}),
      1,
    );
    expect(fixture.requests).toEqual(["/api/stream_function_logs?cursor=0"]);
    expect(fixture.headers).toEqual(["Convex local-test-key"]);
    expect(chunk.coverage).toBe("available-native-log-chunk");
    expect(chunk.returned).toBe(1);
    expect(chunk.requested).toBe(1);
    expect(chunk.newCursor).toBe(456);
    expect(chunk.entries[0].logLines[0].messages).toEqual(["new ***"]);
  });
  it("empty chunk is valid with precise zero returned count and clean real-registry JSON", async () => {
    const { config } = await server((_req, res) => send(res));
    const output = jest.spyOn(console, "log").mockImplementation(() => {});
    await createProgram(config)
      .exitOverride()
      .parseAsync([
        "node",
        "cortex",
        "convex",
        "logs",
        "-d",
        "logs",
        "--format",
        "json",
      ]);
    const value = JSON.parse(String(output.mock.calls[0][0]));
    expect(value.entries).toEqual([]);
    expect(value.requested).toBe(50);
    expect(value.returned).toBe(0);
  });
  it("requires key/installed version and rejects overlap/invalid lines before requests", async () => {
    const fixture = await server((_req, res) => send(res));
    const target = resolveNativeTarget(fixture.config, {});
    await expect(readFiniteLogs({ ...target, key: "" })).rejects.toThrow(
      "key is required",
    );
    await expect(readFiniteLogs(target, 1001)).rejects.toThrow("1 to 1000");
    const release = acquireForegroundSignalHandler(async () => {});
    await expect(readFiniteLogs(target)).rejects.toThrow("already active");
    release();
    expect(fixture.requests).toEqual([]);
    fs.writeFileSync(
      path.join(target.project, "node_modules/convex/package.json"),
      '{"name":"convex","version":"1.45.0","bin":"bin/main.js"}',
    );
    await expect(readFiniteLogs(target)).rejects.toThrow("1.46.0");
    expect(fixture.requests).toEqual([]);
  });
  it("refuses redirects and never forwards the selected key to another server", async () => {
    const other = await server((_req, res) => send(res));
    const first = await server((_req, res) => {
      res.statusCode = 302;
      res.setHeader("Location", other.config.deployments.logs.url + "/foreign");
      res.end();
    });
    await expect(
      readFiniteLogs(resolveNativeTarget(first.config, {})),
    ).rejects.toThrow("redirects are refused");
    expect(other.requests).toEqual([]);
  });
  it.each([401, 403, 404, 500])(
    "HTTP %s is sanitized nonzero failure, never empty success",
    async (status) => {
      const fixture = await server((_req, res) => {
        res.statusCode = status;
        res.end("sensitive local-test-key");
      });
      await expect(
        readFiniteLogs(resolveNativeTarget(fixture.config, {})),
      ).rejects.toThrow(`HTTP ${status}`);
      const release = acquireForegroundSignalHandler(async () => {});
      release();
    },
  );
  it("refuses incompatible MIME and malformed JSON", async () => {
    const first = await server((_req, res) => {
      res.setHeader("Content-Type", "text/html");
      res.end("server secret");
    });
    await expect(
      readFiniteLogs(resolveNativeTarget(first.config, {})),
    ).rejects.toThrow("content type");
    const second = await server((_req, res) => {
      res.setHeader("Content-Type", "application/json");
      res.end("{bad local-test-key");
    });
    await expect(
      readFiniteLogs(resolveNativeTarget(second.config, {})),
    ).rejects.toThrow("Malformed native log JSON");
  });
  it.each([
    { entries: [], newCursor: -1 },
    { entries: [], newCursor: "1" },
    { entries: "bad", newCursor: 1 },
    { entries: [{ ...event(), kind: "Unknown" }], newCursor: 1 },
    { entries: [{ ...event(), timestamp: "123" }], newCursor: 1 },
    { entries: [{ ...event(), logLines: ["unstructured"] }], newCursor: 1 },
    {
      entries: [
        {
          ...event(),
          logLines: [
            { messages: [1], level: "LOG", timestamp: 123, isTruncated: false },
          ],
        },
      ],
      newCursor: 1,
    },
    {
      entries: [
        {
          ...event(),
          logLines: [
            {
              messages: ["x"],
              level: "SECRET",
              timestamp: 123,
              isTruncated: false,
            },
          ],
        },
      ],
      newCursor: 1,
    },
    { entries: [{ ...event(), componentPath: 2 }], newCursor: 1 },
    { entries: [{ ...event(), kind: "Completion" }], newCursor: 1 },
  ])("unsupported event envelope refuses: %#", (value) => {
    expect(() => validateNativeLogPayload(value)).toThrow(
      "Unsupported native log protocol",
    );
  });
  it("accepts full completion essentials and optional nulls, refusing missing usage/invalid OCC", () => {
    const usage = Object.fromEntries(
      [
        "databaseReadBytes",
        "databaseWriteBytes",
        "databaseIoReadBytes",
        "databaseIoWriteBytes",
        "databaseReadDocuments",
        "databaseWriteDocuments",
        "databaseWriteIndexRows",
        "storageReadBytes",
        "storageWriteBytes",
        "vectorIndexReadBytes",
        "vectorIndexWriteBytes",
        "textIndexQueryBytes",
        "textIndexWriteQueryBytes",
        "vectorIndexReadQueryBytes",
        "vectorIndexWriteQueryBytes",
        "networkEgressBytes",
        "memoryUsedMb",
      ].map((key) => [key, 0]),
    );
    const completion = {
      ...event(),
      kind: "Completion",
      cachedResult: false,
      caller: "cli",
      executionTime: 0,
      executionTimestamp: 123,
      environment: "convex",
      identityType: "admin",
      willRetry: false,
      usageStats: usage,
      parentExecutionId: null,
      userExecutionTime: null,
      success: null,
      error: null,
      returnBytes: null,
      occInfo: null,
    };
    expect(
      validateNativeLogPayload({ entries: [completion], newCursor: 1 })
        .entries[0].kind,
    ).toBe("Completion");
    expect(() =>
      validateNativeLogPayload({
        entries: [{ ...completion, usageStats: {} }],
        newCursor: 1,
      }),
    ).toThrow("protocol");
    expect(() =>
      validateNativeLogPayload({
        entries: [{ ...completion, occInfo: { retryCount: "one" } }],
        newCursor: 1,
      }),
    ).toThrow("protocol");
  });
  it("enforces depth/node limits and streamed byte cap without Content-Length", async () => {
    let depth: unknown = {};
    for (let i = 0; i < 20; i++) depth = { child: depth };
    expect(() =>
      validateNativeLogPayload({
        entries: [event()],
        newCursor: 1,
        additive: depth,
      }),
    ).toThrow("protocol");
    const fixture = await server((_req, res) => {
      res.setHeader("Content-Type", "application/json");
      res.write('"');
      for (let i = 0; i < 130; i++) res.write("x".repeat(65536));
      res.end('"');
    });
    await expect(
      readFiniteLogs(resolveNativeTarget(fixture.config, {})),
    ).rejects.toThrow("aborted or timed out");
  });
  it("renders hostile Unicode/newlines in CSV and table without changing complete events", () => {
    const chunk = {
      formatVersion: 1 as const,
      coverage: "available-native-log-chunk" as const,
      requested: 1,
      returned: 1,
      newCursor: 1,
      entries: [event()],
    };
    const output = jest.spyOn(console, "log").mockImplementation(() => {});
    jest.spyOn(console, "error").mockImplementation(() => {});
    printFiniteLogs(chunk, { format: "csv" });
    expect(String(output.mock.calls[0][0])).toContain('"hello,""世界""\nline"');
    printFiniteLogs(chunk, { format: "table", quiet: true });
    expect(String(output.mock.calls[1][0])).toContain("probe:work");
    printFiniteLogs(chunk, { jsonl: true });
    expect(JSON.parse(String(output.mock.calls[2][0])).kind).toBe("Progress");
  });
  it.each(["table", "csv", "json", "jsonl"] as const)(
    "preserves complete long function and multiline Unicode messages in %s",
    (format) => {
      const identifier =
        "component/path:" +
        "function世界".repeat(15) +
        "_REQUIRED_FUNCTION_END";
      const message =
        'PREFIX_"' +
        "日本語".repeat(50) +
        "_REQUIRED_MESSAGE_END_世界\nSECOND_REQUIRED_LINE\r\nTHIRD_LINE";
      const entry = { ...event(message), identifier };
      const chunk = {
        formatVersion: 1 as const,
        coverage: "available-native-log-chunk" as const,
        requested: 1,
        returned: 1,
        newCursor: 1,
        entries: [entry],
      };
      const output = jest.spyOn(console, "log").mockImplementation(() => {});
      const diagnostic = jest
        .spyOn(console, "error")
        .mockImplementation(() => {});
      printFiniteLogs(chunk, { format, jsonl: format === "jsonl" });
      const rendered = String(output.mock.calls[0][0]);
      if (format === "json")
        expect(JSON.parse(rendered).entries[0]).toEqual(entry);
      else if (format === "jsonl") expect(JSON.parse(rendered)).toEqual(entry);
      else {
        expect(rendered).toContain(identifier);
        expect(rendered).toContain(
          format === "csv" ? message.replaceAll('"', '""') : message,
        );
        expect(rendered).toContain("_REQUIRED_MESSAGE_END_世界");
        expect(rendered).toContain("SECOND_REQUIRED_LINE");
      }
      if (format !== "json")
        expect(diagnostic.mock.calls[0][0]).toContain("Logs: 1/1 entries");
    },
  );
  it("preserves failure text and explicitly requested success summaries in table/CSV", () => {
    const failure =
      "ERROR_" + "long原因".repeat(30) + "_FINAL_ERROR\nNEXT_ERROR_LINE";
    const failed = {
      ...event("original log"),
      kind: "Completion" as const,
      error: failure,
    };
    const succeeded = {
      ...event("success log"),
      kind: "Completion" as const,
      error: null,
    };
    const chunk = {
      formatVersion: 1 as const,
      coverage: "available-native-log-chunk" as const,
      requested: 2,
      returned: 2,
      newCursor: 1,
      entries: [failed, succeeded],
    };
    const output = jest.spyOn(console, "log").mockImplementation(() => {});
    jest.spyOn(console, "error").mockImplementation(() => {});
    for (const format of ["table", "csv"]) {
      printFiniteLogs(chunk, { format, success: true });
      const rendered = String(output.mock.calls.at(-1)![0]);
      expect(rendered).toContain(failure);
      expect(rendered).toContain("failure");
      expect(rendered).toContain("Function execution succeeded");
    }
  });
  it("renders one wide Unicode value and 999 short events without value-width padding amplification", () => {
    const identifier = "界".repeat(1024 * 1024);
    const entries = Array.from({ length: 1000 }, (_, index) => ({
      ...event("short"),
      identifier: index ? "short:function" : identifier,
    }));
    const chunk = {
      formatVersion: 1 as const,
      coverage: "available-native-log-chunk" as const,
      requested: 1000,
      returned: 1000,
      newCursor: 1,
      entries,
    };
    const output = jest.spyOn(console, "log").mockImplementation(() => {});
    jest.spyOn(console, "error").mockImplementation(() => {});
    const originalRepeat = String.prototype.repeat;
    jest.spyOn(String.prototype, "repeat").mockImplementation(function (
      this: string,
      count: number,
    ) {
      if (count > 1024) throw new Error("Attempted large column padding");
      return originalRepeat.call(this, count);
    });
    printFiniteLogs(chunk, { format: "table" });
    const rendered = String(output.mock.calls[0][0]);
    expect(rendered).toContain(identifier);
    expect(rendered).toContain("Entry 1000");
    expect(Buffer.byteLength(rendered + "\n")).toBeLessThan(4 * 1024 * 1024);
  });
  it.each(["table", "csv", "json", "jsonl"] as const)(
    "%s charges exact UTF8 output including final LF and rejects overflow before stdout or success coverage",
    (format) => {
      const entry = event("");
      const chunk = {
        formatVersion: 1 as const,
        coverage: "available-native-log-chunk" as const,
        requested: 1,
        returned: 1,
        newCursor: 1,
        entries: [entry],
      };
      const output = jest.spyOn(console, "log").mockImplementation(() => {});
      const diagnostic = jest
        .spyOn(console, "error")
        .mockImplementation(() => {});
      const options = { format, jsonl: format === "jsonl" };
      printFiniteLogs(chunk, options);
      const remaining =
        8 * 1024 * 1024 -
        Buffer.byteLength(String(output.mock.calls[0][0]) + "\n");
      entry.logLines[0].messages = [
        "界".repeat(Math.floor(remaining / 3)) + "x".repeat(remaining % 3),
      ];
      output.mockClear();
      diagnostic.mockClear();
      printFiniteLogs(chunk, options);
      expect(Buffer.byteLength(String(output.mock.calls[0][0]) + "\n")).toBe(
        8 * 1024 * 1024,
      );
      entry.logLines[0].messages[0] += "x";
      output.mockClear();
      diagnostic.mockClear();
      expect(() => printFiniteLogs(chunk, options)).toThrow(
        "8 MiB whole-event output budget",
      );
      expect(output).not.toHaveBeenCalled();
      expect(diagnostic).not.toHaveBeenCalled();
    },
  );
  it("preflights CSV quote expansion without allocating over-budget encoded fields or reporting success", () => {
    const entry = event('"'.repeat(4 * 1024 * 1024));
    const chunk = {
      formatVersion: 1 as const,
      coverage: "available-native-log-chunk" as const,
      requested: 1,
      returned: 1,
      newCursor: 1,
      entries: [entry],
    };
    const output = jest.spyOn(console, "log").mockImplementation(() => {});
    const diagnostic = jest
      .spyOn(console, "error")
      .mockImplementation(() => {});
    const replace = jest.spyOn(String.prototype, "replaceAll");
    expect(() => printFiniteLogs(chunk, { format: "csv" })).toThrow(
      "8 MiB whole-event output budget",
    );
    expect(replace).not.toHaveBeenCalled();
    expect(output).not.toHaveBeenCalled();
    expect(diagnostic).not.toHaveBeenCalled();
  });
  it.each(["headers", "body"] as const)(
    "applies the fixed 70-second deadline through stalled %s and clears its lease/timer",
    async (stage) => {
      const fixture = await server(() => {});
      let cancel: ReturnType<typeof jest.spyOn> | undefined;
      let releaseReader: ReturnType<typeof jest.spyOn> | undefined;
      jest
        .spyOn(globalThis, "fetch")
        .mockImplementation(async (_input, options) => {
          const signal = options!.signal!;
          if (stage === "headers")
            return await new Promise<Response>((_resolve, reject) => {
              signal.addEventListener(
                "abort",
                () => reject(new Error("aborted")),
                { once: true },
              );
            });
          const stream = new ReadableStream<Uint8Array>({
            start(controller) {
              signal.addEventListener(
                "abort",
                () => controller.error(new Error("aborted")),
                { once: true },
              );
            },
          });
          const original = stream.getReader.bind(stream);
          jest.spyOn(stream, "getReader").mockImplementation(() => {
            const reader = original();
            cancel = jest.spyOn(reader, "cancel");
            releaseReader = jest.spyOn(reader, "releaseLock");
            return reader;
          });
          return new Response(stream, {
            headers: { "Content-Type": "application/json" },
          });
        });
      jest.useFakeTimers();
      let settled = false;
      const reading = readFiniteLogs(resolveNativeTarget(fixture.config, {}));
      void reading.then(
        () => {
          settled = true;
        },
        () => {
          settled = true;
        },
      );
      const rejection = expect(reading).rejects.toThrow("timed out");
      await jest.advanceTimersByTimeAsync(69999);
      expect(settled).toBe(false);
      expect(jest.getTimerCount()).toBe(1);
      await jest.advanceTimersByTimeAsync(1);
      await rejection;
      expect(jest.getTimerCount()).toBe(0);
      if (stage === "body") {
        expect(cancel).toHaveBeenCalledTimes(1);
        expect(releaseReader).toHaveBeenCalledTimes(1);
      }
      const release = acquireForegroundSignalHandler(async () => {});
      release();
    },
  );
  it("aborts repeated signals idempotently and disposes the reader/lease", async () => {
    let seen: () => void = () => {};
    const request = new Promise<void>((resolve) => {
      seen = resolve;
    });
    const fixture = await server(() => seen());
    const reading = readFiniteLogs(resolveNativeTarget(fixture.config, {}));
    await request;
    process.emit("SIGINT");
    process.emit("SIGINT");
    await expect(reading).rejects.toThrow("interrupted");
    await new Promise((resolve) => setImmediate(resolve));
    expect(process.exitCode).toBe(130);
    const release = acquireForegroundSignalHandler(async () => {});
    release();
  });
  it("handler rejection is sanitized and repeated signals call it once", async () => {
    const error = jest.spyOn(console, "error").mockImplementation(() => {});
    let calls = 0;
    const release = acquireForegroundSignalHandler(async () => {
      calls++;
      throw new Error("secret rejected");
    });
    process.emit("SIGTERM");
    process.emit("SIGTERM");
    await new Promise((resolve) => setImmediate(resolve));
    release();
    expect(calls).toBe(1);
    expect(process.exitCode).toBe(1);
    expect(error.mock.calls.flat().join(" ")).toBe(
      "Owned command/native cleanup failed or remains incomplete",
    );
  });
});
