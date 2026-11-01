import {
  jest,
  describe,
  test,
  expect,
  beforeEach,
  afterEach,
} from "@jest/globals";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import net from "node:net";

const calls: string[][] = [];
let running = false,
  exists = false,
  foreign = false,
  authBad = false,
  usersInitialized = false,
  failFirstUp = false,
  authOpen = false,
  userCreates = 0,
  initialized = 0,
  probed = 0,
  closed = 0,
  driverClosed = 0,
  sessionsClosed = 0;
let root: string;
const execFile = jest.fn(
  (
    _: string,
    args: string[],
    _options: unknown,
    callback: (error: Error | null, out: string, err: string) => void,
  ) => {
    calls.push([...args]);
    queueMicrotask(() => {
      if (args[0] === "info") return callback(null, "29.8.1", "");
      if (args[0] === "compose" && args[1] === "version")
        return callback(null, "5.5.1", "");
      if (args.includes("up")) {
        exists = true;
        running = true;
        if (failFirstUp) { failFirstUp = false; return callback(new Error("controlled first-start failure"), "", ""); }
        return callback(null, "", "");
      }
      if (args[0] === "stop") {
        running = false;
        return callback(null, "", "");
      }
      if (!exists)
        return callback(new Error("absent"), "", `No such ${args[0]}`);
      const owner = JSON.parse(
        fs.readFileSync(
          path.join(root, ".cortex/graph/ownership.json"),
          "utf8",
        ),
      );
      const labels = {
        ...owner.labels,
        "com.docker.compose.project": owner.composeProject,
      };
      if (foreign) labels["io.cortex.graph.project"] = "foreign";
      if (args[0] === "volume")
        return callback(
          null,
          JSON.stringify([
            {
              Name: owner.volume,
              Labels: { ...labels, "com.docker.compose.volume": "data" },
            },
          ]),
          "",
        );
      callback(
        null,
        JSON.stringify([
          {
            Id: "test-owned-cid",
            Name: `/${owner.composeProject}-${owner.service}-1`,
            Config: {
              Image: owner.image,
              Labels: {
                ...labels,
                "com.docker.compose.service": owner.service,
                "com.docker.compose.project.working_dir": root,
                "com.docker.compose.project.config_files": path.join(
                  root,
                  ".cortex/graph/compose.json",
                ),
              },
            },
            State: { Running: running },
            HostConfig: {
              PortBindings: {
                "7687/tcp": [
                  { HostIp: "127.0.0.1", HostPort: String(owner.boltPort) },
                ],
                ...(owner.httpPort === undefined
                  ? {}
                  : {
                      "7474/tcp": [
                        {
                          HostIp: "127.0.0.1",
                          HostPort: String(owner.httpPort),
                        },
                      ],
                    }),
              },
            },
            Mounts: [
              {
                Type: "volume",
                Name: owner.volume,
                Destination:
                  owner.provider === "neo4j" ? "/data" : "/var/lib/memgraph",
              },
            ],
          },
        ]),
        "",
      );
    });
  },
);
jest.unstable_mockModule("node:child_process", () => ({ execFile }));
jest.unstable_mockModule("neo4j-driver", () => ({
  default: {
    auth: { basic: (username: string, password: string) => ({ username, password }) },
    driver: (_uri: string, auth?: { username: string; password: string }) => ({
      session: () => ({
        run: async (query: string) => {
          const memgraph = fs.existsSync(path.join(root, ".cortex/graph/ownership.json")) &&
            JSON.parse(fs.readFileSync(path.join(root, ".cortex/graph/ownership.json"), "utf8")).provider === "memgraph";
          const stored = fs.existsSync(path.join(root, ".cortex/graph/credentials.json")) ?
            JSON.parse(fs.readFileSync(path.join(root, ".cortex/graph/credentials.json"), "utf8")) : undefined;
          const expected = stored?.[memgraph ? "MEMGRAPH_PASSWORD" : "NEO4J_PASSWORD"] ?? "private-existing";
          const enforced = !authOpen && (!memgraph || usersInitialized);
          if (authBad || (enforced && (!auth || auth.password !== expected)))
            throw Object.assign(new Error("private detail"), {
              code: "Neo.ClientError.Security.Unauthorized",
            });
          if (query.startsWith("CREATE USER")) { usersInitialized = true; userCreates++; }
          return { records: query === "SHOW USERS" ? (usersInitialized ? [{}] : []) : [{}] };
        },
        close: async () => { sessionsClosed++; },
      }),
      close: async () => { driverClosed++; },
    }),
  },
}));
jest.unstable_mockModule("@cortexmemory/sdk", () => ({
  CypherGraphAdapter: class {
    async connect() {}
    async disconnect() {
      closed++;
    }
  },
  initializeGraphSchema: async () => {
    initialized++;
  },
  assertManagedGraphCompatibility: async () => {
    probed++;
  },
}));
const {
  setupGraph,
  graphLifecycle,
  readSelectedGraphConfiguration,
  readSelectedGraphEnvironment,
} = await import("../../src/utils/graph/service.js");

beforeEach(() => {
  root = fs.realpathSync(
    fs.mkdtempSync(
      path.join(
        process.env.CORTEX_TEST_HOME_ROOT ?? os.tmpdir(),
        "graph-service-",
      ),
    ),
  );
  calls.length = 0;
  running = false;
  exists = false;
  foreign = false;
  authBad = false;
  usersInitialized = false;
  failFirstUp = false;
  authOpen = false;
  userCreates = 0;
  initialized = 0;
  probed = 0;
  closed = 0;
  driverClosed = 0;
  sessionsClosed = 0;
});
afterEach(() => fs.rmSync(root, { recursive: true, force: true }));
const local = (graph: "neo4j" | "memgraph" = "neo4j") => ({
  graph,
  boltPort: 56822,
  ...(graph === "neo4j" ? { httpPort: 56824 } : {}),
  credentials: {
    username: graph === "neo4j" ? "neo4j" : "cortexadmin",
    password: "synthetic-only-$'\\ password",
  },
});
describe("one shared graph service", () => {
  test("none and skip need no project, Docker, SDK, driver or writes", async () => {
    expect((await setupGraph(path.join(root, "absent"), {})).status).toBe(
      "disabled",
    );
    expect(
      (await setupGraph(path.join(root, "absent"), { skipGraph: true })).status,
    ).toBe("disabled");
    expect(calls).toEqual([]);
    expect(probed + initialized + driverClosed + closed).toBe(0);
    expect(fs.readdirSync(root)).toEqual([]);
  });
  test("enabled skip conflicts before every effect", async () => {
    await expect(
      setupGraph(root, { graph: "neo4j", skipGraph: true }),
    ).rejects.toThrow("GRAPH_SKIP_CONFLICT");
    expect(calls).toEqual([]);
    expect(fs.readdirSync(root)).toEqual([]);
  });
  test("new-directory dry run creates no project or service", async () => {
    expect(
      (await setupGraph(path.join(root, "new"), { ...local(), dryRun: true }))
        .status,
    ).toBe("planned");
    expect(fs.readdirSync(root)).toEqual([]);
    expect(calls).toEqual([]);
  });
  test.each(["neo4j", "memgraph"] as const)(
    "%s setup and repeat retain credentials/volume; lifecycle validates exact ownership",
    async (provider) => {
      const first = await setupGraph(root, local(provider));
      expect(first.status).toBe("ready");
      expect(first.authentication).toBe("verified");
      expect(first.image).toMatch(/@sha256:/);
      expect(JSON.stringify(first)).not.toContain("synthetic-only");
      const secret = path.join(root, ".cortex/graph/credentials.json"),
        bytes = fs.readFileSync(secret);
      expect(fs.statSync(secret).mode & 0o777).toBe(0o600);
      const second = await setupGraph(root, local(provider));
      expect(second.containerId).toBe(first.containerId);
      expect(fs.readFileSync(secret)).toEqual(bytes);
      expect(initialized).toBe(2);
      expect(closed).toBe(2);
      const env = await readSelectedGraphEnvironment(root);
      expect(env.CORTEX_GRAPH_SYNC).toBe("true");
      expect(env.CORTEX_GRAPH_PROVIDER).toBe(provider);
      expect(env[`${provider.toUpperCase()}_PASSWORD`]).toBe(
        local(provider).credentials.password,
      );
      expect(env[`${provider.toUpperCase()}_URI`]).toBe(first.uri);
      expect(first.environmentSource).toBe(".cortex/graph/credentials.json");
      const config = await readSelectedGraphConfiguration(root);
      expect(config.credentials.password).toBe(
        local(provider).credentials.password,
      );
      expect(config.ownership?.volume).toContain(config.ownership?.projectId);
      expect((await graphLifecycle(root, "status")).status).toBe("ready");
      expect((await graphLifecycle(root, "stop")).status).toBe("stopped");
      const stop = calls.find((a) => a[0] === "stop");
      expect(stop).toEqual(["stop", "--time", "20", "test-owned-cid"]);
      foreign = true;
      const count = calls.filter((a) => a[0] === "stop").length;
      await expect(graphLifecycle(root, "stop")).rejects.toThrow(
        "GRAPH_RESOURCE_CONFLICT",
      );
      expect(calls.filter((a) => a[0] === "stop").length).toBe(count);
    },
  );
  test("failed first start retains private files but retry initializes missing actual users", async () => {
    failFirstUp = true;
    await expect(setupGraph(root, local("memgraph"))).rejects.toThrow("GRAPH_DOCKER_COMMAND_FAILED");
    expect(usersInitialized).toBe(false);
    expect(running).toBe(false);
    const secret = fs.readFileSync(path.join(root, ".cortex/graph/credentials.json"));
    expect((await setupGraph(root, local("memgraph"))).authentication).toBe("verified");
    expect(usersInitialized).toBe(true);
    expect(fs.readFileSync(path.join(root, ".cortex/graph/credentials.json"))).toEqual(secret);
    expect(driverClosed).toBe(sessionsClosed);
  });
  test("existing open authentication refuses without user or file mutation", async () => {
    authOpen = true;
    await expect(setupGraph(root, { graph: "memgraph", graphMode: "existing",
      graphUri: "bolt://127.0.0.1:56822", credentials: { username: "cortexadmin", password: "private-existing" }
    })).rejects.toThrow("GRAPH_AUTHENTICATION_UNENFORCED");
    expect(userCreates).toBe(0);
    expect(calls).toEqual([]);
    expect(fs.readdirSync(root)).toEqual([]);
    expect(driverClosed).toBe(sessionsClosed);
  });
  test("repeat never recreates an existing authenticated user", async () => {
    await setupGraph(root, local("memgraph"));
    expect(userCreates).toBe(1);
    await graphLifecycle(root, "stop");
    await graphLifecycle(root, "start");
    expect(userCreates).toBe(1);
  });
  test("busy port refuses before file/container writes", async () => {
    const server = net.createServer();
    await new Promise<void>((resolve) =>
      server.listen(0, "127.0.0.1", resolve),
    );
    const port = (server.address() as net.AddressInfo).port;
    try {
      await expect(
        setupGraph(root, { ...local("memgraph"), boltPort: port }),
      ).rejects.toThrow("GRAPH_PORT_BUSY");
      expect(fs.readdirSync(root)).toEqual([]);
      expect(calls.some((a) => a.includes("up"))).toBe(false);
    } finally {
      await new Promise<void>((resolve, reject) =>
        server.close((e) => (e ? reject(e) : resolve())),
      );
    }
  });
  test("symlink escape and user-owned dotenv refuse before writes or startup", async () => {
    fs.symlinkSync(os.tmpdir(), path.join(root, ".cortex"));
    await expect(setupGraph(root, local())).rejects.toThrow(
      "GRAPH_SYMLINK_CONFLICT",
    );
    fs.unlinkSync(path.join(root, ".cortex"));
    fs.writeFileSync(
      path.join(root, ".env.local"),
      "NEO4J_PASSWORD=user-selected-secret\n",
    );
    await expect(setupGraph(root, local())).rejects.toThrow(
      "GRAPH_USER_ENV_CONFLICT",
    );
    expect(calls).toEqual([]);
  });
  test("genuine classified wrong auth closes sessions/drivers and stops only newly started owner", async () => {
    authBad = true;
    await expect(setupGraph(root, local())).rejects.toThrow(
      "GRAPH_AUTHENTICATION_FAILED",
    );
    expect(running).toBe(false);
    expect(calls.filter((a) => a[0] === "stop")).toEqual([
      ["stop", "--time", "20", "test-owned-cid"],
    ]);
    expect(driverClosed).toBe(1);
    expect(sessionsClosed).toBe(1);
    expect(initialized).toBe(0);
  });
  test("existing setup/status only authenticate/verify, persist private selected source and refuse start/stop", async () => {
    const options = {
      graph: "neo4j" as const,
      graphMode: "existing" as const,
      graphUri: "bolt://127.0.0.1:56822",
      credentials: { username: "neo4j", password: "private-existing" },
    };
    const result = await setupGraph(root, options);
    expect(result.status).toBe("ready");
    expect(initialized).toBe(0);
    expect(probed).toBe(1);
    expect(calls).toEqual([]);
    expect((await graphLifecycle(root, "status")).status).toBe("ready");
    for (const action of ["start", "stop"] as const)
      await expect(graphLifecycle(root, action)).rejects.toThrow(
        "GRAPH_EXTERNAL_LIFECYCLE_REFUSED",
      );
    const env = await readSelectedGraphEnvironment(root);
    expect(env.CORTEX_GRAPH_SYNC).toBe("true");
    expect(env.NEO4J_PASSWORD).toBe("private-existing");
    const before = fs.readFileSync(
      path.join(root, ".cortex/graph/credentials.json"),
    );
    await expect(
      setupGraph(root, { ...options, graphUri: "bolt://127.0.0.1:56823" }),
    ).rejects.toThrow("GRAPH_OWNERSHIP_CONFLICT");
    expect(
      fs.readFileSync(path.join(root, ".cortex/graph/credentials.json")),
    ).toEqual(before);
    expect(probed).toBe(2);
  });
});
