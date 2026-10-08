import {
  jest,
  describe,
  it,
  expect,
  afterEach,
  beforeAll,
} from "@jest/globals";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  applyBackendPlan,
  BACKEND_MANIFEST,
  discoverBackendFiles,
  getFunctionsDirectory,
  hashBytes,
  planBackendSync,
  resolveProjectDirectory,
  validateSdkPackage,
} from "../schema-sync.js";
import {
  installSdk,
  validateInstallOptions,
  validateNpmProject,
} from "../install.js";
beforeAll(() => {
  if (
    !process.env.CORTEX_TEST_HOME_ROOT ||
    fs.realpathSync(os.homedir()) !==
      fs.realpathSync(process.env.CORTEX_TEST_HOME_ROOT)
  )
    throw new Error("Externally isolated native HOME required before imports");
});
const roots: string[] = [];
const temp = () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "cortex-task02-test-"));
  roots.push(root);
  return root;
};
const sdk = () => {
  const root = temp();
  fs.mkdirSync(path.join(root, "convex-dev/nested"), { recursive: true });
  fs.mkdirSync(path.join(root, "convex-dev/_generated"));
  fs.writeFileSync(
    path.join(root, "package.json"),
    JSON.stringify({ name: "@cortexmemory/sdk", version: "0.38.0" }),
  );
  fs.writeFileSync(
    path.join(root, "convex-dev/schema.ts"),
    "export default {};\n",
  );
  fs.writeFileSync(
    path.join(root, "convex-dev/admin.ts"),
    "import { internalQuery, internalMutation } from './_generated/server';\n" +
      [
        ["listTable", "internalQuery"],
        ["countTable", "internalQuery"],
        ["getAllCounts", "internalQuery"],
        ["clearTable", "internalMutation"],
        ["deleteRecord", "internalMutation"],
      ]
        .map(([name, fn]) => `export const ${name} = ${fn}({});`)
        .join("\n"),
  );
  fs.writeFileSync(
    path.join(root, "convex-dev/nested/function.ts"),
    "export const nested = 1;\n",
  );
  fs.writeFileSync(
    path.join(root, "convex-dev/_generated/api.ts"),
    "should not copy",
  );
  return root;
};
const tree = (root: string): Record<string, string> => {
  const result: Record<string, string> = {};
  const walk = (directory: string) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const file = path.join(directory, entry.name),
        relative = path.relative(root, file);
      if (entry.isSymbolicLink())
        result[relative] = `link:${fs.readlinkSync(file)}`;
      else if (entry.isDirectory()) {
        result[`${relative}/`] = "directory";
        walk(file);
      } else result[relative] = hashBytes(fs.readFileSync(file));
    }
  };
  walk(root);
  return result;
};
afterEach(() => {
  jest.restoreAllMocks();
  for (const root of roots.splice(0))
    fs.rmSync(root, { recursive: true, force: true });
});
describe("ownership planner outcomes", () => {
  it("recursively copies configured backend preserving generated/custom files, then is idempotent", () => {
    const project = temp(),
      source = sdk();
    fs.writeFileSync(
      path.join(project, "convex.json"),
      '{"functions":"backend/functions/","auth":{"keep":true}}',
    );
    fs.mkdirSync(path.join(project, "backend/functions/_generated"), {
      recursive: true,
    });
    fs.writeFileSync(
      path.join(project, "backend/functions/_generated/api.ts"),
      "user generated",
    );
    fs.writeFileSync(
      path.join(project, "backend/functions/custom.ts"),
      "user code",
    );
    const plan = planBackendSync(project, source);
    expect(plan.additions).toEqual([
      "admin.ts",
      "nested/function.ts",
      "schema.ts",
    ]);
    applyBackendPlan(plan);
    expect(
      fs.readFileSync(
        path.join(project, "backend/functions/nested/function.ts"),
        "utf8",
      ),
    ).toBe("export const nested = 1;\n");
    expect(
      fs.readFileSync(
        path.join(project, "backend/functions/_generated/api.ts"),
        "utf8",
      ),
    ).toBe("user generated");
    expect(
      fs.readFileSync(
        path.join(project, "backend/functions/custom.ts"),
        "utf8",
      ),
    ).toBe("user code");
    const before = tree(project),
      again = planBackendSync(project, source);
    expect(again.additions).toEqual([]);
    expect(again.updates).toEqual([]);
    applyBackendPlan(again);
    expect(tree(project)).toEqual(before);
    const ownership = JSON.parse(
      fs.readFileSync(path.join(project, BACKEND_MANIFEST), "utf8"),
    );
    expect(ownership.sdk.version).toBe("0.38.0");
    expect(fs.statSync(path.join(project, BACKEND_MANIFEST)).mode & 0o777).toBe(
      0o600,
    );
    expect(ownership.files["schema.ts"]).toBe(
      hashBytes("export default {};\n"),
    );
  });
  it("preflights every conflict and scopes explicit overwrite recovery", () => {
    const project = temp(),
      source = sdk();
    fs.mkdirSync(path.join(project, "convex"));
    fs.writeFileSync(
      path.join(project, "convex/schema.ts"),
      "arbitrary schema",
    );
    fs.writeFileSync(path.join(project, "convex/auth.config.ts"), "auth");
    const before = tree(project),
      plan = planBackendSync(project, source);
    expect(plan.conflicts).toEqual(["schema.ts"]);
    expect(() => applyBackendPlan(plan)).toThrow("Backend conflicts");
    expect(tree(project)).toEqual(before);
    const backup = applyBackendPlan(plan, { overwrite: true });
    expect(backup).toMatch(/^\.cortex\/backups\//);
    expect(
      fs.readFileSync(path.join(project, backup!, "convex/schema.ts"), "utf8"),
    ).toBe("arbitrary schema");
    expect(
      fs.readFileSync(path.join(project, "convex/auth.config.ts"), "utf8"),
    ).toBe("auth");
    fs.writeFileSync(path.join(project, "convex/schema.ts"), "edited owned");
    expect(planBackendSync(project, source).conflicts).toEqual(["schema.ts"]);
    fs.unlinkSync(path.join(project, "convex/schema.ts"));
    expect(planBackendSync(project, source).conflicts).toEqual(["schema.ts"]);
  });
  it("dry-run preserves exact tree and refuses race changes", () => {
    const project = temp(),
      source = sdk(),
      before = tree(project),
      plan = planBackendSync(project, source);
    applyBackendPlan(plan, { dryRun: true });
    expect(tree(project)).toEqual(before);
    fs.mkdirSync(path.join(project, "convex"));
    fs.writeFileSync(path.join(project, "convex/schema.ts"), "raced");
    expect(() => applyBackendPlan(plan)).toThrow("changed since preflight");
    expect(fs.existsSync(path.join(project, "convex/admin.ts"))).toBe(false);
  });
  it("rolls back disk failure including created directories", () => {
    const project = temp(),
      source = sdk(),
      before = tree(project),
      plan = planBackendSync(project, source),
      rename = fs.renameSync;
    let calls = 0;
    jest.spyOn(fs, "renameSync").mockImplementation((from, to) => {
      if (++calls === 2) throw new Error("injected disk error");
      rename(from, to);
    });
    expect(() => applyBackendPlan(plan)).toThrow("injected disk error");
    expect(tree(project)).toEqual(before);
  });
  it("rejects traversal, project/file symlinks, malformed ownership and SDK links", () => {
    const project = temp(),
      source = sdk(),
      outside = temp();
    fs.writeFileSync(
      path.join(project, "convex.json"),
      '{"functions":"../escape"}',
    );
    expect(() => getFunctionsDirectory(project)).toThrow("Unsafe");
    fs.writeFileSync(
      path.join(project, "convex.json"),
      '{"functions":"convex"}',
    );
    fs.symlinkSync(outside, path.join(project, "convex"));
    expect(() => planBackendSync(project, source)).toThrow("Symlink");
    expect(() =>
      resolveProjectDirectory(path.join(project, "convex/sub")),
    ).toThrow("Symlink");
    fs.unlinkSync(path.join(project, "convex"));
    fs.mkdirSync(path.join(project, ".cortex"));
    fs.writeFileSync(path.join(project, BACKEND_MANIFEST), "{}");
    expect(() => planBackendSync(project, source)).toThrow("ownership");
    fs.symlinkSync(outside, path.join(source, "convex-dev/link"));
    expect(() => discoverBackendFiles(source)).toThrow("symlink");
  });
  it("rejects wrong candidate identity and public raw admin", () => {
    const source = sdk();
    fs.writeFileSync(
      path.join(source, "package.json"),
      '{"name":"other","version":"0.38.0"}',
    );
    expect(() => validateSdkPackage(source)).toThrow("identity");
    fs.writeFileSync(
      path.join(source, "package.json"),
      '{"name":"@cortexmemory/sdk","version":"0.38.0"}',
    );
    fs.appendFileSync(
      path.join(source, "convex-dev/admin.ts"),
      "\nexport const dangerous = mutation({});",
    );
    expect(() => validateSdkPackage(source)).toThrow(
      "registration binding rejected",
    );
  });
});
describe("installer preservation", () => {
  it("stages and repeats npm installation preserving scripts/settings/secrets/local state/lock", async () => {
    const project = temp(),
      source = sdk();
    fs.writeFileSync(
      path.join(project, "package.json"),
      JSON.stringify({
        name: "existing",
        version: "7.0.0",
        scripts: { build: "custom" },
        dependencies: { other: "2.0.0" },
        packageManager: "npm@11.19.1",
      }),
    );
    fs.writeFileSync(
      path.join(project, "convex.json"),
      '{"functions":"custom/functions/","auth":"settings"}',
    );
    fs.writeFileSync(path.join(project, ".env.local"), "SECRET=private\n");
    fs.mkdirSync(path.join(project, ".convex"));
    fs.writeFileSync(
      path.join(project, ".convex/state"),
      "persistent local state",
    );
    fs.writeFileSync(
      path.join(project, "package-lock.json"),
      '{"lockfileVersion":3,"name":"existing","packages":{}}',
    );
    const before = tree(project),
      options = { sdkPackage: source, install: false, deploy: false };
    const dry = await installSdk(project, { ...options, dryRun: true });
    expect(dry.convexVersion).toBe("1.46.0");
    expect(tree(project)).toEqual(before);
    await installSdk(project, options);
    const manifest = JSON.parse(
      fs.readFileSync(path.join(project, "package.json"), "utf8"),
    );
    expect(manifest.scripts.build).toBe("custom");
    expect(manifest.version).toBe("7.0.0");
    expect(manifest.dependencies.other).toBe("2.0.0");
    expect(manifest.dependencies.convex).toBe("1.46.0");
    for (const name of [
      ".env.local",
      ".convex/state",
      "package-lock.json",
      "convex.json",
    ])
      expect(tree(project)[name]).toBe(before[name]);
    const installed = tree(project);
    await installSdk(project, options);
    expect(tree(project)).toEqual(installed);
  });
  it.each(["pnpm-lock.yaml", "yarn.lock", "bun.lock", "npm-shrinkwrap.json"])(
    "refuses %s before any writes",
    async (lock) => {
      const project = temp(),
        source = sdk();
      fs.writeFileSync(
        path.join(project, "package.json"),
        '{"name":"existing"}',
      );
      fs.writeFileSync(path.join(project, lock), "unsupported");
      const before = tree(project);
      await expect(
        installSdk(project, {
          sdkPackage: source,
          install: false,
          deploy: false,
        }),
      ).rejects.toThrow("lockfile");
      expect(tree(project)).toEqual(before);
    },
  );
  it("rejects managers/malformed sections and incompatible options", () => {
    const project = temp();
    fs.writeFileSync(
      path.join(project, "package.json"),
      '{"packageManager":"pnpm@10.0.0"}',
    );
    expect(() => validateNpmProject(project)).toThrow("npm");
    fs.writeFileSync(path.join(project, "package.json"), '{"dependencies":[]}');
    expect(() => validateNpmProject(project)).toThrow("dependencies");
    fs.writeFileSync(path.join(project, "package.json"), '{"name":"existing"}');
    const outside = temp();
    fs.symlinkSync(outside, path.join(project, "node_modules"));
    expect(() => validateNpmProject(project)).toThrow("Symlink");
    for (const options of [
      { local: true, cloud: true },
      { template: "chat-sdk" },
      { start: true },
      { skipGraph: true, graph: "neo4j" },
      { graph: "neo4j" },
      { install: false },
    ])
      expect(() => validateInstallOptions(options)).toThrow();
  });
  it("basic init excludes secrets/artifacts and compiles only; backend-only has no app", async () => {
    const root = temp(),
      source = sdk(),
      project = path.join(root, "basic app");
    await installSdk(
      project,
      { sdkPackage: source, install: false, deploy: false, template: "basic" },
      true,
    );
    const files = tree(project);
    expect(files[".env.local"]).toBeUndefined();
    expect(files["coverage/"]).toBeUndefined();
    expect(files["node_modules/"]).toBeUndefined();
    expect(files["src/index.ts"]).toBeDefined();
    const manifest = JSON.parse(
      fs.readFileSync(path.join(project, "package.json"), "utf8"),
    );
    expect(manifest.version).toBe("1.2.0");
    expect(manifest.scripts.build).toBe("tsc");
    expect(manifest.scripts["build:convex"]).toBe("convex deploy");
    const minimal = path.join(root, "backend-only");
    await installSdk(
      minimal,
      { sdkPackage: source, install: false, deploy: false, template: "none" },
      true,
    );
    expect(JSON.parse(fs.readFileSync(path.join(minimal, "package.json"), "utf8"))).toMatchObject({
      packageManager: "npm@12.2.0", engines: { node: ">=24.15.0" },
      devDependencies: { typescript: "~6.0.3", "@types/node": "^26.6.4" },
    });
    expect(fs.existsSync(path.join(minimal, "src"))).toBe(false);
    expect(fs.existsSync(path.join(minimal, "convex/schema.ts"))).toBe(true);
  });
});

describe("defensive admin binding validation", () => {
  const canonicalImport =
    "import { internalQuery, internalMutation } from './_generated/server';";
  it.each([
    [
      "alternate origin",
      (text: string) =>
        text.replace("'./_generated/server'", "'convex/server'"),
    ],
    [
      "renamed imports",
      (text: string) =>
        text.replace(
          canonicalImport,
          "import { query as internalQuery, mutation as internalMutation } from './_generated/server';",
        ),
    ],
    [
      "ambiguous aliases",
      (text: string) =>
        text.replace(
          canonicalImport,
          "import { internalMutation as internalQuery, internalQuery as internalMutation } from './_generated/server';",
        ),
    ],
    ["duplicate origin", (text: string) => canonicalImport + "\n" + text],
    [
      "namespace import",
      (text: string) =>
        text.replace(
          canonicalImport,
          "import * as server from './_generated/server';",
        ),
    ],
    [
      "top-level rebinding",
      (text: string) =>
        text.replace(
          canonicalImport,
          canonicalImport + "\nconst internalQuery = otherRegistration;",
        ),
    ],
    [
      "nested shadowing",
      (text: string) =>
        text.replace(
          "internalQuery({});",
          "internalQuery({ handler: (internalQuery) => internalQuery });",
        ),
    ],
    [
      "additional exports",
      (text: string) =>
        text + "\nexport const additional = otherRegistration({});",
    ],
  ])(
    "refuses %s before staging with exact project preservation",
    async (_label, transform) => {
      const source = sdk(),
        project = temp();
      const admin = path.join(source, "convex-dev/admin.ts");
      fs.writeFileSync(admin, transform(fs.readFileSync(admin, "utf8")));
      fs.writeFileSync(
        path.join(project, "package.json"),
        '{"name":"binding-refusal","scripts":{"custom":"keep"}}',
      );
      fs.writeFileSync(
        path.join(project, "convex.json"),
        '{"functions":"existing/","auth":{"keep":true}}',
      );
      fs.mkdirSync(path.join(project, "existing"));
      fs.writeFileSync(
        path.join(project, "existing/user.ts"),
        "user-owned bytes",
      );
      const before = tree(project);
      const write = jest.spyOn(fs, "writeFileSync");
      await expect(
        installSdk(project, {
          sdkPackage: source,
          install: false,
          deploy: false,
        }),
      ).rejects.toThrow("registration binding rejected");
      expect(write).not.toHaveBeenCalled();
      expect(tree(project)).toEqual(before);
      expect(fs.existsSync(path.join(project, BACKEND_MANIFEST))).toBe(false);
    },
  );
  it("accepts canonical bindings statically without loading the package entrypoint", () => {
    const source = sdk();
    fs.writeFileSync(
      path.join(source, "package.json"),
      JSON.stringify({
        name: "@cortexmemory/sdk",
        version: "0.38.0",
        main: "./not-to-load.js",
      }),
    );
    fs.writeFileSync(
      path.join(source, "not-to-load.js"),
      "throw new Error('Package entrypoint must never execute during validation');\n",
    );
    expect(validateSdkPackage(source)).toEqual({
      name: "@cortexmemory/sdk",
      version: "0.38.0",
      sourceHash: expect.stringMatching(/^[a-f0-9]{64}$/),
    });
  });
});

describe("configuration snapshot preflight", () => {
  it.each([
    "functions",
    "bytes",
    "removed",
    "absent-to-present",
    "config-symlink",
    "directory-symlink",
  ])(
    "refuses stale %s with no apply writes and preserved ownership/targets",
    (change) => {
      const project = temp(),
        source = sdk(),
        outside = temp();
      applyBackendPlan(planBackendSync(project, source));
      const manifest = fs.readFileSync(path.join(project, BACKEND_MANIFEST));
      if (change === "absent-to-present")
        fs.unlinkSync(path.join(project, "convex.json"));
      const plan = planBackendSync(project, source);
      if (change === "functions" || change === "absent-to-present") {
        fs.writeFileSync(
          path.join(project, "convex.json"),
          '{"functions":"alternate/","settings":"preserve"}',
        );
        fs.mkdirSync(path.join(project, "alternate"));
        fs.writeFileSync(
          path.join(project, "alternate/sentinel.ts"),
          "new target remains untouched",
        );
      } else if (change === "bytes")
        fs.appendFileSync(path.join(project, "convex.json"), " \n");
      else if (change === "removed")
        fs.unlinkSync(path.join(project, "convex.json"));
      else if (change === "config-symlink") {
        fs.writeFileSync(
          path.join(outside, "configuration.json"),
          '{"functions":"convex/"}',
        );
        fs.unlinkSync(path.join(project, "convex.json"));
        fs.symlinkSync(
          path.join(outside, "configuration.json"),
          path.join(project, "convex.json"),
        );
      } else {
        fs.rmSync(path.join(project, "convex"), { recursive: true });
        fs.writeFileSync(
          path.join(outside, "sentinel.ts"),
          "outside target remains untouched",
        );
        fs.symlinkSync(outside, path.join(project, "convex"));
      }
      const before = tree(project),
        outsideBefore = tree(outside);
      const write = jest.spyOn(fs, "writeFileSync");
      expect(() => applyBackendPlan(plan, { overwrite: true })).toThrow(
        /configuration changed|Symlink/,
      );
      expect(write).not.toHaveBeenCalled();
      expect(tree(project)).toEqual(before);
      expect(tree(outside)).toEqual(outsideBefore);
      expect(fs.readFileSync(path.join(project, BACKEND_MANIFEST))).toEqual(
        manifest,
      );
      expect(fs.existsSync(path.join(project, ".cortex/backups"))).toBe(false);
    },
  );
  it.each([2, 3])(
    "refuses a config change at manifest read %s before installer writes, preserving the user's new config",
    async (changeAtRead) => {
      const project = temp(),
        source = sdk();
      fs.writeFileSync(
        path.join(project, "package.json"),
        '{"name":"preflight-race","scripts":{"build":"keep"}}',
      );
      fs.writeFileSync(
        path.join(project, "convex.json"),
        '{"functions":"original/"}',
      );
      fs.mkdirSync(path.join(project, "original"));
      fs.mkdirSync(path.join(project, "alternate"));
      fs.writeFileSync(
        path.join(project, "original/sentinel.ts"),
        "original target",
      );
      fs.writeFileSync(
        path.join(project, "alternate/sentinel.ts"),
        "alternate target",
      );
      const manifestBefore = fs.readFileSync(
        path.join(project, "package.json"),
      );
      const read = fs.readFileSync;
      const userWrite = fs.writeFileSync;
      const installerWrite = jest.spyOn(fs, "writeFileSync");
      let reads = 0;
      jest.spyOn(fs, "readFileSync").mockImplementation(((
        file: fs.PathOrFileDescriptor,
        options?: unknown,
      ) => {
        if (
          String(file) === path.join(project, "package.json") &&
          ++reads === changeAtRead
        )
          userWrite(
            path.join(project, "convex.json"),
            '{"functions":"alternate/","userChange":true}',
          );
        return Reflect.apply(read, fs, [file, options]);
      }) as typeof fs.readFileSync);
      await expect(
        installSdk(project, {
          sdkPackage: source,
          install: false,
          deploy: false,
        }),
      ).rejects.toThrow("Convex configuration changed since preflight");
      expect(installerWrite).not.toHaveBeenCalled();
      expect(fs.readFileSync(path.join(project, "package.json"))).toEqual(
        manifestBefore,
      );
      expect(fs.readFileSync(path.join(project, "convex.json"), "utf8")).toBe(
        '{"functions":"alternate/","userChange":true}',
      );
      expect(
        fs.readFileSync(path.join(project, "original/sentinel.ts"), "utf8"),
      ).toBe("original target");
      expect(
        fs.readFileSync(path.join(project, "alternate/sentinel.ts"), "utf8"),
      ).toBe("alternate target");
      expect(fs.existsSync(path.join(project, BACKEND_MANIFEST))).toBe(false);
      expect(fs.existsSync(path.join(project, "original/admin.ts"))).toBe(
        false,
      );
      expect(fs.existsSync(path.join(project, "alternate/admin.ts"))).toBe(
        false,
      );
    },
  );
});
