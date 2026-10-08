import { it, expect, jest, beforeEach, afterEach } from "@jest/globals";
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  statSync,
  readdirSync,
  realpathSync,
  rmSync,
} from "fs";
import { join } from "path";
import { tmpdir } from "os";
const realOs = await import("os");
jest.unstable_mockModule("os", () => ({
  ...realOs,
  homedir: () => process.env.HOME!,
}));
const {
  loadConfig,
  saveUserConfig,
  saveProjectConfig,
  setConfigValue,
  updateDeployment,
  validateConfigShape,
  getUserConfigPath,
  saveEffectiveConfig,
  getDeployment,
  resolveConfig,
  setDefaultDeployment,
  registerApp,
} = await import("../config.js");
const {
  setCurrentDeployment,
  getCurrentDeployment,
  clearCurrentDeployment,
  selectDeployment,
} = await import("../deployment-selector.js");
import type { CLIConfig } from "../../types.js";
let root: string;
let oldCwd: string;
let oldHome: string | undefined;
const value = (): CLIConfig => ({
  deployments: {
    shared: {
      url: "http://127.0.0.1:43210",
      key: "user-only-secret",
      futureField: "keep",
    },
  },
  default: "shared",
  format: "table",
  confirmDangerous: true,
  bookmarks: ["user"],
});
beforeEach(() => {
  oldCwd = process.cwd();
  oldHome = process.env.HOME;
  root = realpathSync(mkdtempSync(join(tmpdir(), "cortex-sources-")));
  mkdirSync(join(root, "home"));
  mkdirSync(join(root, "project"));
  process.env.HOME = join(root, "home");
  process.chdir(join(root, "project"));
  if (realOs.homedir() !== process.env.CORTEX_TEST_HOME_ROOT)
    throw new Error("Native HOME is not externally isolated");
  expect(getUserConfigPath()).toBe(join(root, "home/.cortexrc"));
});
afterEach(() => {
  process.chdir(oldCwd);
  if (oldHome === undefined) delete process.env.HOME;
  else process.env.HOME = oldHome;
  rmSync(root, { recursive: true, force: true });
});
it("project URL priority preserves metadata but never inherits another endpoint credential", async () => {
  await saveUserConfig(value());
  writeFileSync(
    "cortex.config.json",
    JSON.stringify({
      deployments: { shared: { url: "https://project.convex.cloud" } },
      format: "json",
      bookmarks: ["project"],
      version: 2,
    }),
  );
  const resolved = await loadConfig();
  expect(resolved.deployments.shared).toEqual({
    url: "https://project.convex.cloud",
    futureField: "keep",
  });
  expect(resolved.format).toBe("json");
  expect(resolved.version).toBe(2);
  expect(resolved.bookmarks).toEqual(["project"]);
});
it("mutates effective project without copying user credentials/entries or changing user bytes", async () => {
  await saveUserConfig(value());
  writeFileSync(
    "cortex.config.json",
    JSON.stringify({ format: "json", projectBookmark: "keep" }),
  );
  const userBefore = readFileSync(join(root, "home/.cortexrc"), "utf-8");
  await setConfigValue("format", "csv");
  await updateDeployment("shared", {
    ...(await loadConfig()).deployments.shared,
    url: "https://changed.convex.cloud",
  });
  const saved = JSON.parse(readFileSync("cortex.config.json", "utf-8"));
  expect(saved).toEqual({
    format: "csv",
    projectBookmark: "keep",
    deployments: { shared: { url: "https://changed.convex.cloud" } },
  });
  expect(readFileSync(join(root, "home/.cortexrc"), "utf-8")).toBe(userBefore);
  expect((await loadConfig()).deployments.shared.key).toBeUndefined();
});
it("user/project saves are private, complete, atomic and retain unknown fields", async () => {
  await saveUserConfig(value());
  await saveProjectConfig(value());
  for (const path of [join(root, "home/.cortexrc"), "cortex.config.json"]) {
    expect(statSync(path).mode & 0o777).toBe(0o600);
    expect(JSON.parse(readFileSync(path, "utf-8"))).toEqual(value());
  }
  expect(readdirSync(join(root, "home"))).toEqual([".cortexrc"]);
  expect(readdirSync(process.cwd())).toEqual(["cortex.config.json"]);
});
it.each([
  "{",
  "[]",
  '{"deployments":{"bad":{"url":"file:///secret"}}}',
  '{"__proto__":{"polluted":true}}',
])("rejects malformed/unsafe user source %s", async (raw) => {
  writeFileSync(join(root, "home/.cortexrc"), raw);
  await expect(loadConfig()).rejects.toThrow("Invalid user configuration");
});
it("rejects malformed project and invalid values without overwriting", async () => {
  await saveUserConfig(value());
  writeFileSync("cortex.config.json", "{");
  await expect(loadConfig()).rejects.toThrow("Invalid project");
  expect(readFileSync("cortex.config.json", "utf-8")).toBe("{");
});
it.each([
  { format: "xml" },
  { confirmDangerous: "yes" },
  { deployments: { x: { url: "https://user:secret@example.com" } } },
  {
    deployments: { x: { url: "https://example.com", projectPath: "relative" } },
  },
  {
    apps: {
      x: {
        type: "future",
        path: "x",
        projectPath: "/tmp",
        enabled: true,
        port: 65536,
      },
    },
  },
])("validates shape/bounds", (bad) =>
  expect(() => validateConfigShape(bad)).toThrow(),
);
it("rejects dangerous prototype and empty URL/key saves without writes", async () => {
  expect(() => validateConfigShape(Object.create({ deployments: {} }))).toThrow(
    "object",
  );
  await saveUserConfig(value());
  const before = readFileSync(join(root, "home/.cortexrc"), "utf-8");
  await expect(setConfigValue("confirmDangerous", "yes")).rejects.toThrow(
    "true or false",
  );
  await expect(setConfigValue("convex-key", "\nsecret")).rejects.toThrow(
    "file path",
  );
  expect(readFileSync(join(root, "home/.cortexrc"), "utf-8")).toBe(before);
});
it("scoped use cannot leak to another project, and legacy selection is retained", async () => {
  writeFileSync(join(root, "home/.cortex-current"), "legacy-global");
  await setCurrentDeployment("shared");
  expect(await getCurrentDeployment()).toBe("shared");
  mkdirSync(join(root, "another"));
  process.chdir(join(root, "another"));
  expect(await getCurrentDeployment()).toBeNull();
  await setCurrentDeployment("another");
  const anotherScope = process.cwd();
  process.chdir(join(root, "project"));
  await clearCurrentDeployment();
  expect(await getCurrentDeployment()).toBeNull();
  const store = JSON.parse(
    readFileSync(join(root, "home/.cortex-current"), "utf-8"),
  );
  expect(store.legacy).toBe("legacy-global");
  expect(store.selections[anotherScope]).toBe("another");
});
it("selection precedence explicit > scoped use > default > singleton; wrong/missing/ambiguous fail", async () => {
  const config = value();
  config.deployments.second = { url: "https://second.convex.cloud" };
  await setCurrentDeployment("second");
  expect((await selectDeployment(config, { deployment: "shared" }))?.name).toBe(
    "shared",
  );
  expect((await selectDeployment(config, {}))?.name).toBe("second");
  await clearCurrentDeployment();
  expect((await selectDeployment(config, {}))?.name).toBe("shared");
  config.default = "";
  await expect(selectDeployment(config, {})).rejects.toThrow(
    "Choose a deployment",
  );
  delete config.deployments.second;
  expect((await selectDeployment(config, {}))?.name).toBe("shared");
  await expect(
    selectDeployment(config, { deployment: "missing" }),
  ).rejects.toThrow("not found");
  await expect(
    selectDeployment({ ...config, deployments: {} }, {}),
  ).rejects.toThrow("No deployments");
});

it("environment URLs never override configured deployment selection", async () => {
  await saveUserConfig(value());
  const original = process.env.CONVEX_URL;
  try {
    process.env.CONVEX_URL = "https://unrelated.invalid";
    expect((await loadConfig()).deployments.shared.url).toBe(
      value().deployments.shared.url,
    );
  } finally {
    if (original === undefined) delete process.env.CONVEX_URL;
    else process.env.CONVEX_URL = original;
  }
});

it.each([false, true])(
  "refuses inherited or mixed-source deletion before touching either source (overlay %s)",
  async (overlay) => {
    await saveUserConfig(value());
    writeFileSync(
      "cortex.config.json",
      JSON.stringify({
        projectBookmark: "keep",
        ...(overlay
          ? { deployments: { shared: { url: "https://overlay.invalid" } } }
          : {}),
      }),
    );
    const userBefore = readFileSync(join(root, "home/.cortexrc"), "utf-8");
    const projectBefore = readFileSync("cortex.config.json", "utf-8");
    const config = await loadConfig();
    delete config.deployments.shared;
    config.default = "";
    await expect(saveEffectiveConfig(config)).rejects.toThrow(
      "Cannot remove inherited",
    );
    expect(readFileSync(join(root, "home/.cortexrc"), "utf-8")).toBe(
      userBefore,
    );
    expect(readFileSync("cortex.config.json", "utf-8")).toBe(projectBefore);
  },
);

it.each([
  [{ url: "http://127.0.0.1:43210/" }, "user-only-secret"],
  [{ futureField: "project" }, "user-only-secret"],
  [
    { url: "https://project.invalid", key: "intentional-project-secret" },
    "intentional-project-secret",
  ],
])(
  "same endpoint inherits credentials; explicit project credential is endpoint-specific (%j)",
  async (overlay, key) => {
    await saveUserConfig(value());
    const before = readFileSync(getUserConfigPath(), "utf-8");
    writeFileSync(
      "cortex.config.json",
      JSON.stringify({ deployments: { shared: overlay } }),
    );
    expect((await loadConfig()).deployments.shared.key).toBe(key);
    expect(readFileSync(getUserConfigPath(), "utf-8")).toBe(before);
  },
);

it.each(["update", "convex-url", "effective"])(
  "user URL mutation %s drops carried old credential on reload",
  async (method) => {
    await saveUserConfig(value());
    const url = "https://changed.invalid";
    if (method === "convex-url") await setConfigValue("convex-url", url);
    else if (method === "update")
      await updateDeployment("shared", { ...value().deployments.shared, url });
    else {
      const loaded = await loadConfig();
      loaded.deployments.shared.url = url;
      await saveEffectiveConfig(loaded);
    }
    expect((await loadConfig()).deployments.shared).toEqual({
      url,
      futureField: "keep",
    });
    expect(
      JSON.parse(readFileSync(getUserConfigPath(), "utf-8")).deployments.shared
        .key,
    ).toBeUndefined();
  },
);

it("an intentional distinct new key persists with a changed endpoint", async () => {
  await saveUserConfig(value());
  await updateDeployment("shared", {
    ...value().deployments.shared,
    url: "https://changed.invalid",
    key: "new-endpoint-key",
  });
  expect((await loadConfig()).deployments.shared.key).toBe("new-endpoint-key");
});

it("changing project-owned endpoint removes its own stale key without touching user source", async () => {
  await saveUserConfig(value());
  const before = readFileSync(getUserConfigPath(), "utf-8");
  writeFileSync(
    "cortex.config.json",
    JSON.stringify({
      deployments: {
        shared: {
          url: "https://project.invalid",
          key: "project-old-key",
          metadata: "keep",
        },
      },
      marker: "keep",
    }),
  );
  await updateDeployment("shared", {
    ...(await loadConfig()).deployments.shared,
    url: "https://changed.invalid",
  });
  expect((await loadConfig()).deployments.shared).toEqual({
    url: "https://changed.invalid",
    futureField: "keep",
    metadata: "keep",
  });
  expect(JSON.parse(readFileSync("cortex.config.json", "utf-8"))).toEqual({
    deployments: {
      shared: { url: "https://changed.invalid", metadata: "keep" },
    },
    marker: "keep",
  });
  expect(readFileSync(getUserConfigPath(), "utf-8")).toBe(before);
});

it.each([
  "constructor",
  "__proto__",
  "prototype",
  "toString",
  "hasOwnProperty",
  "missing",
])(
  "absent alias %s never resolves or changes defaults/prototypes",
  async (name) => {
    await saveUserConfig(value());
    const before = readFileSync(getUserConfigPath(), "utf-8");
    const original = Object.getOwnPropertyDescriptors(Object.prototype);
    const constructor = Object.getOwnPropertyDescriptors(Object);
    expect(getDeployment(await loadConfig(), name)).toBeNull();
    const loaded = await loadConfig();
    expect(() => resolveConfig(loaded, { deployment: name })).toThrow();
    await expect(setDefaultDeployment(name)).rejects.toThrow();
    await expect(setConfigValue("default", name)).rejects.toThrow();
    await expect(
      setConfigValue("convex-key", "fake-key", { deployment: name }),
    ).rejects.toThrow();
    expect(readFileSync(getUserConfigPath(), "utf-8")).toBe(before);
    expect(Object.getOwnPropertyDescriptors(Object.prototype)).toEqual(
      original,
    );
    expect(Object.getOwnPropertyDescriptors(Object)).toEqual(constructor);
  },
);

it("explicitly owned toString alias merges, updates, and sets default as a real entry", async () => {
  await saveUserConfig(value());
  await updateDeployment("toString", {
    url: "http://127.0.0.1:8",
    metadata: "user",
    key: "user-key",
  });
  writeFileSync(
    "cortex.config.json",
    JSON.stringify({ deployments: { toString: { metadata: "project" } } }),
  );
  expect(getDeployment(await loadConfig(), "toString")).toEqual({
    url: "http://127.0.0.1:8",
    metadata: "project",
    key: "user-key",
  });
  await setDefaultDeployment("toString");
  await setConfigValue("convex-key", "updated-key", { deployment: "toString" });
  expect((await loadConfig()).default).toBe("toString");
  expect((await loadConfig()).deployments.toString).toEqual({
    url: "http://127.0.0.1:8",
    metadata: "project",
    key: "updated-key",
  });
  expect(Object.prototype.toString).toBe(Object.getPrototypeOf({}).toString);
});

it("config value targets honor explicit, scoped, default and singleton fallback; stale targets never write", async () => {
  const fixture = value();
  fixture.deployments.second = { url: "http://127.0.0.1:9" };
  await saveUserConfig(fixture);
  await setCurrentDeployment("second");
  await setConfigValue("convex-key", "scoped-key");
  expect((await loadConfig()).deployments.second.key).toBe("scoped-key");
  await setConfigValue("convex-key", "explicit-key", { deployment: "shared" });
  expect((await loadConfig()).deployments.shared.key).toBe("explicit-key");
  await clearCurrentDeployment();
  await setConfigValue("convex-key", "default-key");
  expect((await loadConfig()).deployments.shared.key).toBe("default-key");
  const loaded = await loadConfig();
  delete loaded.deployments.second;
  loaded.default = "";
  await saveEffectiveConfig(loaded);
  await setConfigValue("convex-key", "singleton-key");
  expect((await loadConfig()).deployments.shared.key).toBe("singleton-key");
  for (const name of ["missing", "constructor", "toString"]) {
    const stale = await loadConfig();
    stale.default = name;
    await saveUserConfig(stale);
    const before = readFileSync(getUserConfigPath(), "utf-8");
    await expect(
      setConfigValue("convex-url", "http://127.0.0.1:7"),
    ).rejects.toThrow();
    expect(readFileSync(getUserConfigPath(), "utf-8")).toBe(before);
  }
});

it("registerApp rejects unsafe aliases before any source write", async () => {
  await saveUserConfig(value());
  const before = readFileSync(getUserConfigPath(), "utf-8");
  await expect(
    registerApp({
      name: "__proto__",
      type: "basic",
      path: "app",
      projectPath: process.cwd(),
      fullPath: join(process.cwd(), "app"),
    }),
  ).rejects.toThrow("Invalid");
  expect(readFileSync(getUserConfigPath(), "utf-8")).toBe(before);
});
