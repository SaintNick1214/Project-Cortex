import { describe, it, expect } from "@jest/globals";
import path from "node:path";
import {
  GraphPlanError,
  graphHash,
  graphJson,
  graphPort,
  graphUri,
  graphFiles,
  graphImages,
  normalizeGraphOptions,
  validateGraphProject,
  renderPrivateGraphEnvironment,
  graphResourceIdentity,
  validateGraphResourceIdentity,
  validateGraphOwnership,
  validateGraphResources,
  renderGraphCompose,
  planGraphSetup,
  type GraphOptions,
  type GraphProvider,
  type GraphPlanObservations,
  type SelectedGraphProject,
  type GraphResourceObservation,
} from "../../src/utils/graph/index.js";

const project: SelectedGraphProject = {
  root: "/private/graph-project-a",
  canonicalRoot: "/private/graph-project-a",
  kind: "directory",
  symlink: false,
};
function local(provider: GraphProvider = "neo4j") {
  const result = planGraphSetup({ graph: provider }, { project });
  if (result.mode !== "local") throw new Error("local plan expected");
  return result;
}
function observations(
  provider: GraphProvider = "neo4j",
): GraphPlanObservations {
  const plan = local(provider);
  return {
    project,
    ownership: plan.ownership,
    files: {
      compose: {
        kind: "file",
        hash: graphHash(plan.compose.bytes),
        mode: 0o644,
      },
      ownership: {
        kind: "file",
        hash: graphHash(graphJson(plan.ownership)),
        mode: 0o644,
      },
      credentials: { kind: "file", mode: 0o600 },
    },
  };
}
function resources(
  provider: GraphProvider = "neo4j",
): GraphResourceObservation[] {
  const owner = local(provider).ownership;
  const labels = {
    ...owner.labels,
    "com.docker.compose.project": owner.composeProject,
  };
  return [
    {
      kind: "container",
      name: `${owner.composeProject}-${provider}-1`,
      image: owner.image,
      labels: {
        ...labels,
        "com.docker.compose.service": provider,
        "com.docker.compose.project.working_dir": project.root,
        "com.docker.compose.project.config_files": path.join(
          project.root,
          graphFiles.compose,
        ),
      },
    },
    {
      kind: "volume",
      name: owner.volume,
      labels: { ...labels, "com.docker.compose.volume": "data" },
    },
  ];
}
function refusal(action: () => unknown, code: string) {
  expect(action).toThrow(GraphPlanError);
  expect(action).toThrow(code);
}

describe("offline graph planning", () => {
  it("none and skip require no observations, external tools or writes", () => {
    for (const options of [
      {},
      { graph: "none" as const },
      { skipGraph: true },
    ]) {
      expect(
        planGraphSetup(options, {
          busyPorts: [7687],
          ownership: { invalid: true },
          unownedEnvKeys: ["NEO4J_PASSWORD"],
        }),
      ).toEqual({
        provider: "none",
        mode: "none",
        actions: [],
        writes: [],
        requires: [],
      });
    }
  });
  it.each([
    [{ graph: "other" }, "GRAPH_OPTIONS_INVALID"],
    [{ unexpected: true }, "GRAPH_OPTIONS_INVALID"],
    [{ skipGraph: "yes" }, "GRAPH_OPTIONS_INVALID"],
    [{ graph: "neo4j", skipGraph: true }, "GRAPH_SKIP_CONFLICT"],
    [
      { graph: "none", graphUri: "bolt://localhost" },
      "GRAPH_OFF_OPTIONS_CONFLICT",
    ],
    [{ graph: "neo4j", graphMode: "other" }, "GRAPH_MODE_INVALID"],
    [{ graph: "neo4j", graphMode: "existing" }, "GRAPH_EXISTING_URI_REQUIRED"],
    [
      {
        graph: "neo4j",
        graphMode: "existing",
        graphUri: "bolt://host",
        boltPort: 1234,
      },
      "GRAPH_EXISTING_PORT_CONFLICT",
    ],
    [{ graph: "memgraph", httpPort: 7474 }, "GRAPH_HTTP_PORT_UNSUPPORTED"],
    [{ graph: "neo4j", boltPort: 7474 }, "GRAPH_PORT_CONFLICT"],
    [
      { graph: "neo4j", graphUri: "bolt://remote:7687" },
      "GRAPH_LOCAL_URI_CONFLICT",
    ],
    [
      { graph: "neo4j", graphUri: "bolt://localhost:1111", boltPort: 2222 },
      "GRAPH_LOCAL_PORT_CONFLICT",
    ],
  ])("rejects conflicting options %#", (options, code) =>
    refusal(
      () => normalizeGraphOptions(options as GraphOptions),
      code as string,
    ),
  );

  it.each([0, -1, 65536, 1.2, NaN, Infinity])(
    "refuses invalid port %s",
    (value) => refusal(() => graphPort(value), "GRAPH_PORT_INVALID"),
  );
  it("normalizes validated local ports and supported existing IPv6/TLS URIs", () => {
    expect(graphPort(65535)).toBe(65535);
    expect(
      normalizeGraphOptions({
        graph: "neo4j",
        graphUri: "bolt://localhost:1234",
        httpPort: 5678,
      }),
    ).toEqual({
      provider: "neo4j",
      mode: "local",
      uri: "bolt://127.0.0.1:1234",
      boltPort: 1234,
      httpPort: 5678,
    });
    expect(graphUri("neo4j+s://[::1]:1234/", "neo4j")).toEqual({
      uri: "neo4j+s://[::1]:1234",
      hostname: "[::1]",
      port: 1234,
      protocol: "neo4j+s:",
    });
    expect(graphUri("bolt+ssc://graph.example", "memgraph").uri).toBe(
      "bolt+ssc://graph.example:7687",
    );
  });
  it.each([
    "bolt://user:credential@host",
    "http://host",
    "bolt://host/path",
    "bolt://host?key=credential",
    "bolt://host#credential",
    "bolt://host:0",
    "bolt://host:99999",
    "bolt://host with space",
    "not-a-uri",
  ])("refuses unsafe URI %# without echoing credentials", (value) => {
    try {
      graphUri(value, "neo4j");
      throw new Error("expected refusal");
    } catch (error) {
      expect(error).toBeInstanceOf(GraphPlanError);
      expect((error as Error).message).not.toContain("credential");
    }
  });
  it("refuses unsupported provider and Memgraph routing URI", () => {
    refusal(
      () => graphUri("bolt://host", "wrong" as GraphProvider),
      "GRAPH_OPTIONS_INVALID",
    );
    refusal(() => graphUri("neo4j://host", "memgraph"), "GRAPH_URI_INVALID");
  });
  it("uses deterministic project-specific fixed names", () => {
    const a = graphResourceIdentity(project, "neo4j");
    const b = graphResourceIdentity(
      {
        ...project,
        root: "/private/graph-project-b",
        canonicalRoot: "/private/graph-project-b",
      },
      "neo4j",
    );
    expect(a).toEqual(graphResourceIdentity(project, "neo4j"));
    expect(a.projectId).toMatch(/^[a-f0-9]{24}$/);
    expect(a.composeProject).not.toBe(b.composeProject);
    expect(a.volume).not.toBe(b.volume);
    expect(a.service).toBe("neo4j");
    validateGraphResourceIdentity(a, "neo4j");
    refusal(
      () => validateGraphResourceIdentity({ ...a, volume: "foreign" }, "neo4j"),
      "GRAPH_OWNERSHIP_CONFLICT",
    );
    expect(a.labels["io.cortex.graph.project"]).toBe(a.projectId);
    expect(validateGraphProject(project)).toBe(a.projectId);
    expect(graphHash("abc")).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
    expect(graphJson({ z: 1, a: { c: 2, b: 3 } })).toBe(
      graphJson({ a: { b: 3, c: 2 }, z: 1 }),
    );
  });
  it.each([
    { root: "relative", canonicalRoot: "relative" },
    { root: "/", canonicalRoot: "/" },
    { canonicalRoot: "/private/different" },
    { symlink: true },
    { kind: "file" },
    { root: "/private/../project" },
  ])("refuses unselected/noncanonical project %#", (patch) =>
    refusal(
      () =>
        validateGraphProject({ ...project, ...patch } as SelectedGraphProject),
      "GRAPH_PROJECT_INVALID",
    ),
  );

  it.each(["neo4j", "memgraph"] as const)(
    "renders pinned, loopback, project-owned %s Compose",
    (provider) => {
      const plan = local(provider),
        compose = JSON.parse(plan.compose.bytes);
      const service = compose.services[provider];
      expect(service.image).toBe(graphImages[provider]);
      expect(service.image).toMatch(/@sha256:[a-f0-9]{64}$/);
      expect(service.ports).toEqual(
        provider === "neo4j"
          ? ["127.0.0.1:7687:7687", "127.0.0.1:7474:7474"]
          : ["127.0.0.1:7687:7687"],
      );
      expect(service.volumes).toEqual([
        {
          type: "volume",
          source: "data",
          target: provider === "neo4j" ? "/data" : "/var/lib/memgraph",
        },
      ]);
      expect(compose.volumes.data.name).toBe(plan.ownership.volume);
      expect(service).not.toHaveProperty("container_name");
      expect(service).not.toHaveProperty("platform");
      expect(plan.compose.bytes).not.toContain("docker.sock");
      expect(plan.writes).toEqual(Object.values(graphFiles));
      expect(plan.compose.mode).toBe(0o644);
      expect(plan.preserveVolume).toBe(true);
      expect(plan.requires).toContain("available-selected-ports");
      expect(plan.actions).toContain("authenticated-readiness");
      expect(plan).not.toHaveProperty("ready");
      expect(plan.actions.includes("bootstrap-first-user")).toBe(
        provider === "memgraph",
      );
      expect(plan.authentication).toBe(
        provider === "neo4j"
          ? "neo4j-initial-auth"
          : "memgraph-first-user-bootstrap-and-verify",
      );
    },
  );
  it("validates public Compose ports/provider before rendering", () => {
    const identity = graphResourceIdentity(project, "neo4j");
    refusal(
      () =>
        renderGraphCompose(
          "neo4j",
          { ...identity, labels: { ...identity.labels, password: "private" } },
          { boltPort: 7687 },
        ),
      "GRAPH_OWNERSHIP_CONFLICT",
    );
    refusal(
      () => renderGraphCompose("neo4j", identity, { boltPort: 0 }),
      "GRAPH_PORT_INVALID",
    );
    refusal(
      () =>
        renderGraphCompose("neo4j", identity, {
          boltPort: 1234,
          httpPort: 1234,
        }),
      "GRAPH_PORT_CONFLICT",
    );
    refusal(
      () => renderGraphCompose("memgraph", identity, { boltPort: 7687 }),
      "GRAPH_OWNERSHIP_CONFLICT",
    );
    refusal(
      () =>
        renderGraphCompose(
          "memgraph",
          graphResourceIdentity(project, "memgraph"),
          { boltPort: 7687, httpPort: 7474 },
        ),
      "GRAPH_HTTP_PORT_UNSUPPORTED",
    );
  });
  it.each(["neo4j", "memgraph"] as const)(
    "preserves %s private credential bytes and excludes them from public plan",
    (provider) => {
      const password = `ordinary 'quote' "double" $dollar \\ slash/ 雪 trailing `;
      const privateEnv = renderPrivateGraphEnvironment(
        provider,
        "bolt://127.0.0.1:7687",
        { username: provider === "neo4j" ? "neo4j" : "graph_user", password },
        "local",
      );
      const prefix = provider.toUpperCase(),
        values = JSON.parse(privateEnv.bytes.toString("utf8"));
      expect(values).toEqual({
        [`${prefix}_URI`]: "bolt://127.0.0.1:7687",
        [`${prefix}_USERNAME`]: provider === "neo4j" ? "neo4j" : "graph_user",
        [`${prefix}_PASSWORD`]: password,
      });
      expect(privateEnv.mode).toBe(0o600);
      expect(privateEnv.path).toBe(graphFiles.credentials);
      const plan = local(provider);
      expect(graphJson(plan)).not.toContain(password);
      expect(graphJson(plan.ownership)).not.toContain("PASSWORD");
      expect(plan.compose.bytes).toContain(`\u0024{${prefix}_PASSWORD:?`);
    },
  );
  it("supports explicit existing-server credentials without local restrictions", () => {
    const artifact = renderPrivateGraphEnvironment(
      "neo4j",
      "neo4j+s://host",
      { username: "custom user", password: "short" },
      "existing",
    );
    expect(JSON.parse(artifact.bytes.toString())).toEqual({
      NEO4J_URI: "neo4j+s://host:7687",
      NEO4J_USERNAME: "custom user",
      NEO4J_PASSWORD: "short",
    });
  });
  it("refuses missing/NUL/local incompatible credentials with fixed diagnostics", () => {
    refusal(
      () =>
        renderPrivateGraphEnvironment(
          "neo4j",
          "bolt://localhost",
          { username: "neo4j", password: "" },
          "local",
        ),
      "GRAPH_CREDENTIALS_REQUIRED",
    );
    refusal(
      () =>
        renderPrivateGraphEnvironment(
          "neo4j",
          "bolt://localhost",
          { username: "neo4j", password: "secret\0value" },
          "local",
        ),
      "GRAPH_CREDENTIALS_REQUIRED",
    );
    refusal(
      () =>
        renderPrivateGraphEnvironment(
          "neo4j",
          "bolt://localhost",
          { username: "wrong", password: "ordinary-pass" },
          "local",
        ),
      "GRAPH_LOCAL_AUTH_INVALID",
    );
    refusal(
      () =>
        renderPrivateGraphEnvironment(
          "memgraph",
          "bolt://localhost",
          { username: "bad name", password: "ordinary-pass" },
          "local",
        ),
      "GRAPH_LOCAL_AUTH_INVALID",
    );
    refusal(
      () =>
        renderPrivateGraphEnvironment(
          "memgraph",
          "bolt://remote",
          { username: "good", password: "ordinary-pass" },
          "local",
        ),
      "GRAPH_LOCAL_URI_CONFLICT",
    );
  });
  it("existing mode remains read-only without project files, Compose or initialization", () => {
    expect(
      planGraphSetup(
        {
          graph: "neo4j",
          graphMode: "existing",
          graphUri: "neo4j+s://selected",
        },
        { resources: resources(), busyPorts: [7687] },
      ),
    ).toEqual({
      provider: "neo4j",
      mode: "existing",
      uri: "neo4j+s://selected:7687",
      actions: [
        "read-only-authenticated-probe",
        "read-only-managed-compatibility",
      ],
      writes: [],
      requires: ["explicit-provider-credentials", "accepted-managed-sdk"],
    });
  });
  it("refuses missing project, occupied ports and unowned env without overwrite", () => {
    refusal(() => planGraphSetup({ graph: "neo4j" }), "GRAPH_PROJECT_REQUIRED");
    refusal(
      () => planGraphSetup({ graph: "neo4j" }, { project, busyPorts: [7474] }),
      "GRAPH_PORT_BUSY",
    );
    refusal(
      () =>
        planGraphSetup(
          { graph: "neo4j" },
          { project, unownedEnvKeys: ["NEO4J_PASSWORD"] },
        ),
      "GRAPH_USER_ENV_CONFLICT",
    );
    expect(
      planGraphSetup(
        { graph: "neo4j" },
        { project, unownedEnvKeys: ["UNRELATED_USER_KEY"] },
      ),
    ).toEqual(local());
  });
  it.each(["neo4j", "memgraph"] as const)(
    "reuses exact owned %s configuration without credential/volume replacement",
    (provider) => {
      const observed = observations(provider),
        plan = planGraphSetup({ graph: provider }, observed);
      expect(plan.mode).toBe("local");
      if (plan.mode !== "local") throw new Error("local plan expected");
      expect(plan.writes).toEqual([]);
      expect(plan.preserveCredentials).toBe(true);
      expect(plan.preserveVolume).toBe(true);
      expect(plan.actions).not.toContain("bootstrap-first-user");
      expect(
        validateGraphOwnership(observed.ownership, plan.ownership),
      ).toEqual(plan.ownership);
    },
  );
  it.each([
    { version: 2 },
    { provider: "memgraph" },
    { image: "neo4j:latest" },
    { composeHash: "changed" },
    { password: "credential" },
    { volume: "unrelated" },
  ])("refuses manifest drift/unknown fields %#", (patch) => {
    const plan = local();
    refusal(
      () =>
        validateGraphOwnership({ ...plan.ownership, ...patch }, plan.ownership),
      "GRAPH_OWNERSHIP_CONFLICT",
    );
  });
  it.each([
    { compose: { kind: "symlink" } },
    { compose: { kind: "file", hash: "changed" } },
    { ownership: { kind: "file", hash: "changed" } },
    { credentials: { kind: "file", mode: 0o644 } },
  ])("refuses altered owned files %#", (patch) => {
    const current = observations();
    refusal(
      () =>
        planGraphSetup(
          { graph: "neo4j" },
          {
            ...current,
            files: {
              ...current.files,
              ...patch,
            } as GraphPlanObservations["files"],
          },
        ),
      "GRAPH_OWNED_FILES_CONFLICT",
    );
  });
  it("refuses unowned files/resources rather than adopt them", () => {
    refusal(
      () =>
        planGraphSetup(
          { graph: "neo4j" },
          { project, files: { compose: { kind: "file", hash: "user" } } },
        ),
      "GRAPH_USER_FILES_CONFLICT",
    );
    refusal(
      () =>
        planGraphSetup({ graph: "neo4j" }, { project, resources: resources() }),
      "GRAPH_USER_FILES_CONFLICT",
    );
  });
  it("validates owned resources and only reuses occupied ports with their observations", () => {
    const observed = {
      ...observations(),
      resources: resources(),
      busyPorts: [7687, 7474],
      ownedPorts: [7687, 7474],
    };
    expect(planGraphSetup({ graph: "neo4j" }, observed)).toMatchObject({
      writes: [],
      preserveCredentials: true,
    });
    refusal(
      () => planGraphSetup({ graph: "neo4j" }, { ...observed, resources: [] }),
      "GRAPH_PORT_BUSY",
    );
    refusal(
      () => planGraphSetup({ graph: "neo4j" }, { ...observed, ownedPorts: [] }),
      "GRAPH_PORT_BUSY",
    );
    validateGraphResources(project, local().ownership, resources());
    refusal(
      () =>
        validateGraphResources(
          project,
          { ...local().ownership, service: "memgraph" },
          [],
        ),
      "GRAPH_OWNERSHIP_CONFLICT",
    );
  });
  it.each([
    { name: "foreign-container" },
    { image: "neo4j:latest" },
    { labels: { "com.docker.compose.project": "foreign" } },
    { labels: { "com.docker.compose.service": "other" } },
    { labels: { "com.docker.compose.project.working_dir": "/private/other" } },
    {
      labels: {
        "com.docker.compose.project.config_files":
          "/private/other/compose.json",
      },
    },
  ])("refuses foreign container identity/context %#", (patch) => {
    const current = resources(),
      container = current[0];
    current[0] = {
      ...container,
      ...patch,
      labels: { ...container.labels, ...patch.labels },
    };
    refusal(
      () => validateGraphResources(project, local().ownership, current),
      "GRAPH_RESOURCE_CONFLICT",
    );
  });
  it("refuses foreign volume, duplicate resource and wrong project", () => {
    const current = resources();
    refusal(
      () =>
        validateGraphResources(project, local().ownership, [
          current[0],
          { ...current[1], name: "foreign" },
        ]),
      "GRAPH_RESOURCE_CONFLICT",
    );
    refusal(
      () =>
        validateGraphResources(project, local().ownership, [
          current[0],
          current[0],
        ]),
      "GRAPH_RESOURCE_CONFLICT",
    );
    refusal(
      () =>
        validateGraphResources(
          {
            ...project,
            root: "/private/other",
            canonicalRoot: "/private/other",
          },
          local().ownership,
          current,
        ),
      "GRAPH_OWNERSHIP_CONFLICT",
    );
  });
});
