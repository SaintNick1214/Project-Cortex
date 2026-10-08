import { describe, it, expect, afterEach, jest } from "@jest/globals";
import * as fs from "node:fs/promises";
import path from "node:path";
import {
  hashBytes,
  stableJson,
  validatePayloadPath,
  validateArchive,
  selectCatalogTemplate,
  renderBaseline,
  validateBaseline,
  payloadHash,
  mergePackage,
  planTemplateUpdate,
  applyTemplatePlan,
  recoverTemplateUpdate,
  readTemplateFiles,
  TemplateApplyError,
  type TemplateIdentity,
  type TemplateBaseline,
  type LocalFile,
  type ArchiveEntry,
} from "../../src/utils/templates/index.js";

const bytes = (value: string) => Buffer.from(value);
const file = (value: string, executable = false): LocalFile => ({
  bytes: bytes(value),
  executable,
});
function baseline(
  files: Record<string, string>,
  version = "1.1.0",
  options: {
    projectName?: string;
    executable?: string[];
    envExamples?: string[];
  } = {},
): TemplateBaseline {
  const source = new Map(
    Object.entries(files).map(([name, value]) => [name, bytes(value)]),
  );
  const identity: TemplateIdentity = {
    id: "basic",
    version,
    catalogVersion: "1.0.0",
    catalogHash: "a".repeat(64),
    payloadHash: payloadHash(source),
    manager: "npm",
  };
  return renderBaseline(identity, source, options);
}
const local = (files: Record<string, string>) =>
  new Map(Object.entries(files).map(([name, value]) => [name, file(value)]));
const packageBytes = (value: unknown) => bytes(JSON.stringify(value));
const roots: string[] = [];
async function fixture(
  old: TemplateBaseline,
  files: Record<string, string>,
): Promise<string> {
  const home = process.env.CORTEX_TEST_HOME_ROOT;
  if (!home || home !== process.env.HOME)
    throw new Error("private runner HOME required");
  const root = await fs.mkdtemp(path.join(home, "template-engine-"));
  roots.push(root);
  for (const [name, value] of Object.entries(files)) {
    await fs.mkdir(path.dirname(path.join(root, name)), { recursive: true });
    await fs.writeFile(path.join(root, name), value);
  }
  await fs.mkdir(path.join(root, ".cortex/templates/basic"), {
    recursive: true,
  });
  await fs.writeFile(
    path.join(root, ".cortex/templates/basic/baseline.json"),
    stableJson(old) + "\n",
    { mode: 0o600 },
  );
  return root;
}
async function snapshot(root: string): Promise<Record<string, string>> {
  const result: Record<string, string> = {};
  async function visit(dir: string, relative = "") {
    for (const name of (await fs.readdir(dir)).sort()) {
      const rel = relative ? `${relative}/${name}` : name,
        absolute = path.join(dir, name),
        stat = await fs.lstat(absolute);
      if (stat.isDirectory()) {
        result[rel + "/"] = "directory";
        await visit(absolute, rel);
      } else
        result[rel] = stat.isSymbolicLink()
          ? "link:" + (await fs.readlink(absolute))
          : `${stat.mode & 0o777}:${hashBytes(await fs.readFile(absolute))}`;
    }
  }
  await visit(root);
  return result;
}
afterEach(async () => {
  for (const root of roots.splice(0))
    await fs.rm(root, { recursive: true, force: true });
});

describe("catalog, archive and rendered ownership data", () => {
  it("hashes exact binary bytes and renders only documented parameters into the recorded baseline", () => {
    const source = new Map([
      ["package.json", bytes('{"name":"{{PROJECT_NAME}}"}')],
      ["asset.bin", Buffer.from([0, 255, 1])],
    ]);
    const identity: TemplateIdentity = {
      id: "basic",
      version: "1.1.0",
      catalogVersion: "1.0.0",
      catalogHash: "a".repeat(64),
      payloadHash: payloadHash(source),
      manager: "npm",
    };
    const b = renderBaseline(identity, source, { projectName: "actual-app" });
    expect(
      Buffer.from(b.files["package.json"].content, "base64").toString(),
    ).toBe('{"name":"actual-app"}');
    expect(Buffer.from(b.files["asset.bin"].content, "base64")).toEqual(
      Buffer.from([0, 255, 1]),
    );
    expect(b.parameters).toEqual({ projectName: "actual-app" });
    expect(b.files["package.json"].hash).toBe(
      hashBytes(bytes('{"name":"actual-app"}')),
    );
    expect(() => validateBaseline(b)).not.toThrow();
    expect(() =>
      renderBaseline({ ...identity, payloadHash: "b".repeat(64) }, source),
    ).toThrow("TEMPLATE_PAYLOAD_MISMATCH");
  });
  it.each([
    "",
    "../escape",
    "/absolute",
    "a/../b",
    "a\\b",
    "C:escape",
    "a//b",
    "a/",
    "node_modules/x",
    "convex/_generated/api.ts",
    ".convex/state",
    ".cortex/backend.json",
    ".git/config",
    ".next/cache",
    ".env",
    "src/.env.local",
    "package-lock.json",
    "pnpm-lock.yaml",
    "x\0y",
  ])("refuses protected/nonportable payload path %p", (name) => {
    expect(() => validatePayloadPath(name)).toThrow(/TEMPLATE_(PATH|ENV)_/);
  });
  it("allows only explicit credential-free example names, and rejects malformed parameters/baseline hashes", () => {
    expect(() =>
      validatePayloadPath(".env.example", [".env.example"]),
    ).not.toThrow();
    expect(() => validatePayloadPath(".env.local", [".env.local"])).toThrow(
      "TEMPLATE_ENV_PROTECTED",
    );
    const b = baseline({ "hello.txt": "hello" });
    b.files["hello.txt"].content = bytes("tampered").toString("base64");
    expect(() => validateBaseline(b)).toThrow("TEMPLATE_BASELINE_HASH");
    expect(() => baseline({ "hello.txt": "{{PROJECT_NAME}}" })).toThrow(
      "TEMPLATE_PARAMETER_REQUIRED",
    );
    expect(() =>
      baseline({ "hello.txt": "hello" }, "1.1.0", {
        projectName: "bad\nvalue",
      }),
    ).toThrow("TEMPLATE_PARAMETER_INVALID");
  });
  it("validates exact archive files/counts/kinds/hashes/modes before extraction", () => {
    const content = Buffer.from([0, 1, 255]),
      manifest = [
        {
          path: "src/asset.bin",
          kind: "file" as const,
          hash: hashBytes(content),
          bytes: 3,
          executable: false,
        },
      ];
    const entries: ArchiveEntry[] = [
      { path: "src", kind: "directory" },
      {
        path: "src/asset.bin",
        kind: "file",
        bytes: content,
        executable: false,
      },
    ];
    expect(validateArchive(entries, manifest).get("src/asset.bin")).toEqual(
      content,
    );
    expect(() => validateArchive([], manifest)).toThrow(
      "TEMPLATE_ARCHIVE_INCOMPLETE",
    );
    expect(() => validateArchive([...entries, entries[1]], manifest)).toThrow(
      "TEMPLATE_DUPLICATE_PATH",
    );
    expect(() =>
      validateArchive([{ ...entries[1], bytes: bytes("bad") }], manifest),
    ).toThrow("TEMPLATE_HASH_MISMATCH");
    expect(() =>
      validateArchive([{ ...entries[1], executable: true }], manifest),
    ).toThrow("TEMPLATE_HASH_MISMATCH");
    expect(() =>
      validateArchive(
        [
          {
            path: "unowned",
            kind: "file",
            bytes: bytes("x"),
            executable: false,
          },
        ],
        manifest,
      ),
    ).toThrow("TEMPLATE_ARCHIVE_UNDECLARED");
  });
  it.each(["symlink", "hardlink"] as const)(
    "rejects archive %s instead of following it",
    (kind) => {
      expect(() => validateArchive([{ path: "src", kind }], [])).toThrow(
        "TEMPLATE_ARCHIVE_KIND",
      );
    },
  );
  it("rejects case/path collisions and file parents in payload data", () => {
    expect(() => baseline({ "A.ts": "one", "a.ts": "two" })).toThrow(
      "TEMPLATE_DUPLICATE_PATH",
    );
    expect(() => baseline({ src: "file", "src/x.ts": "child" })).toThrow(
      "TEMPLATE_FILE_PARENT",
    );
  });
  it("selects exact catalog/template identity and delegates declared range checks, never latest fallback", () => {
    const source = new Map([["x.txt", bytes("x")]]);
    const item = {
      id: "basic",
      version: "1.1.0",
      payloadHash: payloadHash(source),
      manager: "npm",
      schemaVersion: 1,
      apiVersion: 1,
      provenance: "canonical/basic",
      envNames: ["CONVEX_URL"],
      backend: true,
      graph: true,
      compatibility: { sdk: "^0.37.0", convex: "1.46.0" },
      files: [
        {
          path: "x.txt",
          kind: "file",
          hash: hashBytes(bytes("x")),
          bytes: 1,
          executable: false,
        },
      ],
    };
    const catalog = bytes(
      JSON.stringify({
        packageName: "@cortexmemory/templates",
        version: "1.0.0",
        schemaVersion: 1,
        apiVersion: 1,
        templates: [item],
      }),
    );
    const selected = {
      id: "basic" as const,
      catalogVersion: "1.0.0",
      templateVersion: "1.1.0",
      catalogHash: hashBytes(catalog),
    };
    const compatibility = jest.fn(() => true);
    expect(
      selectCatalogTemplate(catalog, selected, compatibility),
    ).toMatchObject({
      id: "basic",
      catalogVersion: "1.0.0",
      catalogHash: hashBytes(catalog),
    });
    expect(compatibility.mock.calls).toHaveLength(2);
    expect(() =>
      selectCatalogTemplate(
        catalog,
        { ...selected, templateVersion: "9.9.9" },
        () => true,
      ),
    ).toThrow("TEMPLATE_VERSION_UNAVAILABLE");
    expect(() =>
      selectCatalogTemplate(
        catalog,
        { ...selected, catalogVersion: "9.9.9" },
        () => true,
      ),
    ).toThrow("TEMPLATE_VERSION_UNAVAILABLE");
    expect(() =>
      selectCatalogTemplate(
        catalog,
        { ...selected, catalogHash: "a".repeat(64) },
        () => true,
      ),
    ).toThrow("TEMPLATE_CATALOG_HASH");
    expect(() => selectCatalogTemplate(catalog, selected, () => false)).toThrow(
      "TEMPLATE_COMPATIBILITY_REFUSED",
    );
    const privateProvenance = bytes(
      catalog.toString().replace("canonical/basic", "/private/host/source"),
    );
    expect(() =>
      selectCatalogTemplate(
        privateProvenance,
        { ...selected, catalogHash: hashBytes(privateProvenance) },
        () => true,
      ),
    ).toThrow("TEMPLATE_CATALOG_INVALID");
    const wrongFormat = bytes(
      catalog.toString().replace('"schemaVersion":1', '"schemaVersion":2'),
    );
    expect(() =>
      selectCatalogTemplate(
        wrongFormat,
        { ...selected, catalogHash: hashBytes(wrongFormat) },
        () => true,
      ),
    ).toThrow("TEMPLATE_CATALOG_UNSUPPORTED");
  });
});

describe("semantic package ownership and pure three-way planning", () => {
  it("merges only owned keys, preserves app identity/policy/user keys, and removes unchanged owned dependencies", () => {
    const a = {
      name: "upstream",
      version: "1.1.0",
      private: true,
      packageManager: "npm@10",
      engines: { node: ">=20" },
      dependencies: { owned: "1.0.0", removed: "1.0.0" },
      scripts: { build: "old-build" },
    };
    const b = {
      ...a,
      name: "my-app",
      version: "7.0.0",
      private: false,
      packageManager: "npm@11",
      engines: { node: ">=22" },
      overrides: { x: "2" },
      custom: { mine: true },
      dependencies: { ...a.dependencies, user: "4" },
      scripts: { ...a.scripts, user: "custom" },
    };
    const c = {
      ...a,
      name: "new-upstream",
      version: "1.2.0",
      dependencies: { owned: "2.0.0", added: "3" },
      scripts: { build: "new-build" },
    };
    const result = mergePackage(
      packageBytes(a),
      packageBytes(b),
      packageBytes(c),
    );
    expect(result.conflicts).toEqual([]);
    expect(JSON.parse(result.bytes.toString())).toEqual({
      ...b,
      dependencies: { owned: "2.0.0", added: "3", user: "4" },
      scripts: { build: "new-build", user: "custom" },
    });
  });
  it("preserves local edits when upstream is unchanged or equals local; refuses divergent owned edits/deletions/new keys", () => {
    const a = {
      dependencies: { owned: "1", removed: "1" },
      scripts: { build: "old" },
    };
    const b = {
      dependencies: { owned: "custom", removed: "custom", added: "custom" },
      scripts: { build: "custom" },
    };
    expect(
      mergePackage(packageBytes(a), packageBytes(b), packageBytes(a)).bytes,
    ).toEqual(packageBytes(b));
    expect(
      mergePackage(packageBytes(a), packageBytes(b), packageBytes(b)).conflicts,
    ).toEqual([]);
    expect(
      mergePackage(
        packageBytes(a),
        packageBytes(b),
        packageBytes({
          dependencies: { owned: "2", added: "2" },
          scripts: { build: "new" },
        }),
      ).conflicts,
    ).toEqual([
      "dependencies.added",
      "dependencies.owned",
      "dependencies.removed",
      "scripts.build",
    ]);
  });
  it("uses explicit compatibility for preserved version overrides and rejects cross-map ownership conflicts", () => {
    const a = { dependencies: { sdk: "^0.37.0" } },
      b = { dependencies: { sdk: "^0.38.0" } },
      c = { dependencies: { sdk: "^0.37.1" } };
    const compatible = jest.fn(
      (current: string, incoming: string) =>
        current === "^0.38.0" && incoming === "^0.37.1",
    );
    expect(
      mergePackage(
        packageBytes(a),
        packageBytes(b),
        packageBytes(c),
        compatible,
      ).bytes,
    ).toEqual(packageBytes(b));
    expect(compatible).toHaveBeenCalledWith("^0.38.0", "^0.37.1", "sdk");
    expect(
      mergePackage(
        packageBytes(a),
        packageBytes(b),
        packageBytes(c),
        () => false,
      ).conflicts,
    ).toEqual(["dependencies.sdk"]);
    expect(
      mergePackage(
        packageBytes({}),
        packageBytes({ devDependencies: { sdk: "1" } }),
        packageBytes(a),
      ).conflicts,
    ).toContain("duplicate:sdk");
    expect(
      mergePackage(
        packageBytes(a),
        packageBytes(a),
        packageBytes({ devDependencies: { sdk: "^0.37.0" } }),
      ).conflicts,
    ).toEqual([]);
  });
  it("refuses manager migration and invalid manifests without normalizing user JSON", () => {
    const a = packageBytes({
      packageManager: "npm@10",
      scripts: { build: "x" },
    });
    expect(
      mergePackage(a, a, packageBytes({ packageManager: "pnpm@10" })).conflicts,
    ).toContain("packageManager");
    expect(() => mergePackage(a, bytes("broken"), a)).toThrow(
      "TEMPLATE_PACKAGE_INVALID",
    );
    expect(() =>
      mergePackage(a, packageBytes({ dependencies: [] }), a),
    ).toThrow("TEMPLATE_PACKAGE_INVALID");
    const formatted = bytes(
      '{\n "scripts": { "build": "x" }, "packageManager": "npm@10"\n}',
    );
    expect(mergePackage(a, formatted, a).bytes).toEqual(formatted);
  });
  it("plans all unchanged/upstream/local/equal combinations and unchanged deletion without touching inputs", () => {
    const a = baseline({
      same: "a",
      upstream: "old",
      local: "old",
      equal: "old",
      removed: "old",
    });
    const c = baseline(
      { same: "a", upstream: "new", local: "old", equal: "new", added: "new" },
      "1.2.0",
    );
    const current = local({
      same: "a",
      upstream: "old",
      local: "custom",
      equal: "new",
      removed: "old",
    });
    const plan = planTemplateUpdate(a, c, current);
    expect(plan.conflicts).toEqual([]);
    expect(
      plan.changes.map((x) => [x.path, x.after?.bytes.toString() ?? null]),
    ).toEqual([
      ["added", "new"],
      ["removed", null],
      ["upstream", "new"],
    ]);
    expect(plan.next.files.local.content).toBe(bytes("old").toString("base64"));
    expect(current.get("local")?.bytes.toString()).toBe("custom");
    plan.expected.local!.bytes.fill(0);
    expect(current.get("local")?.bytes.toString()).toBe("custom");
  });
  it("preflights every conflict, including modified deletions and unowned byte-identical collisions unless explicitly adopted", () => {
    const a = baseline({ changed: "old", deleted: "old" }),
      c = baseline({ changed: "new", extra: "new" }, "1.2.0"),
      b = local({ changed: "custom", deleted: "custom", extra: "new" });
    expect(planTemplateUpdate(a, c, b).conflicts).toEqual([
      { path: "changed", reason: "divergent-change" },
      { path: "deleted", reason: "modified-deletion" },
      { path: "extra", reason: "unowned-collision" },
    ]);
    const adopted = planTemplateUpdate(a, c, b, { adoptIdentical: true });
    expect(adopted.adopted).toEqual(["extra"]);
    expect(adopted.next.adoptions).toEqual(["extra"]);
    expect(adopted.conflicts).toHaveLength(2);
  });
  it("uses semantic package merge even when the local package is byte-identical to old", () => {
    const a = baseline({
      "package.json": JSON.stringify({
        name: "actual-app",
        version: "5.0.0",
        dependencies: { sdk: "1" },
      }),
    });
    const c = baseline(
      {
        "package.json": JSON.stringify({
          name: "upstream",
          version: "1.2.0",
          dependencies: { sdk: "2" },
        }),
      },
      "1.2.0",
    );
    const plan = planTemplateUpdate(
      a,
      c,
      local({
        "package.json": Buffer.from(
          a.files["package.json"].content,
          "base64",
        ).toString(),
      }),
    );
    expect(JSON.parse(plan.changes[0].after!.bytes.toString())).toEqual({
      name: "actual-app",
      version: "5.0.0",
      dependencies: { sdk: "2" },
    });
  });
  it("refuses baseline manager/parameter changes and retains executable file-kind ownership", () => {
    const a = baseline({ "run.sh": "old" }, "1.1.0", {
      executable: ["run.sh"],
    });
    const c = baseline({ "run.sh": "new" }, "1.2.0", {
      executable: ["run.sh"],
    });
    expect(
      planTemplateUpdate(a, c, new Map([["run.sh", file("old", true)]]))
        .changes[0].after?.executable,
    ).toBe(true);
    expect(() =>
      planTemplateUpdate(
        a,
        { ...c, identity: { ...c.identity, manager: "pnpm" } },
        local({}),
      ),
    ).toThrow("TEMPLATE_MANAGER_OR_ID_CONFLICT");
    expect(() =>
      planTemplateUpdate(
        a,
        { ...c, parameters: { projectName: "changed" } },
        local({}),
      ),
    ).toThrow("TEMPLATE_RENDER_PARAMETERS_CONFLICT");
  });
  it("refuses an unrequested local manager switch even when upstream package bytes are unchanged", () => {
    const a = baseline({
      "package.json": JSON.stringify({ scripts: { build: "same" } }),
    });
    const plan = planTemplateUpdate(
      a,
      a,
      local({
        "package.json": JSON.stringify({
          packageManager: "pnpm@10",
          scripts: { build: "same" },
        }),
      }),
    );
    expect(plan.conflicts).toEqual([
      { path: "package.json", reason: "packageManager" },
    ]);
    expect(plan.changes).toEqual([]);
  });
  it("refuses case-only old/new collisions instead of deleting a newly adopted file on case-insensitive filesystems", () => {
    expect(() =>
      planTemplateUpdate(
        baseline({ "A.ts": "same" }),
        baseline({ "a.ts": "same" }, "1.2.0"),
        local({ "A.ts": "same", "a.ts": "same" }),
        { adoptIdentical: true },
      ),
    ).toThrow("TEMPLATE_DUPLICATE_PATH");
  });
});

describe("owned filesystem apply, dry-run and recovery", () => {
  it("dry-run compares the whole plan with zero tree/baseline/env/lock/install writes", async () => {
    const a = baseline({ "src/x.ts": "old" }),
      c = baseline({ "src/x.ts": "new", "new/y.ts": "added" }, "1.2.0");
    const root = await fixture(a, {
      "src/x.ts": "old",
      ".env.local": "private-sentinel",
      "package-lock.json": "lock-sentinel",
      "custom.ts": "user-sentinel",
    });
    const current = await readTemplateFiles(root, ["src/x.ts", "new/y.ts"]),
      plan = planTemplateUpdate(a, c, current),
      before = await snapshot(root),
      install = jest.fn(async () => ({ exitCode: 0 }));
    expect(
      await applyTemplatePlan(root, plan, { dryRun: true, install }),
    ).toEqual({ status: "dry-run", changed: 2, dependency: "not-requested" });
    expect(await snapshot(root)).toEqual(before);
    expect(install).not.toHaveBeenCalled();
  });
  it("applies/deletes owned files, keeps env/user/lock state, advances rendered baseline, and repeats as no-op", async () => {
    const a = baseline({ "old.txt": "remove", "src/x.ts": "old" }),
      c = baseline({ "src/x.ts": "new", "new/y.ts": "added" }, "1.2.0");
    const root = await fixture(a, {
      "old.txt": "remove",
      "src/x.ts": "old",
      ".env.local": "private-sentinel",
      "custom.ts": "user",
      "package-lock.json": "lock",
    });
    const plan = planTemplateUpdate(
      a,
      c,
      await readTemplateFiles(root, ["old.txt", "src/x.ts", "new/y.ts"]),
    );
    expect(await applyTemplatePlan(root, plan)).toEqual({
      status: "applied",
      changed: 3,
      dependency: "not-requested",
    });
    expect(await fs.readFile(path.join(root, "src/x.ts"), "utf8")).toBe("new");
    expect(await fs.readFile(path.join(root, "new/y.ts"), "utf8")).toBe(
      "added",
    );
    await expect(fs.stat(path.join(root, "old.txt"))).rejects.toMatchObject({
      code: "ENOENT",
    });
    expect(await fs.readFile(path.join(root, ".env.local"), "utf8")).toBe(
      "private-sentinel",
    );
    expect(
      await fs.readFile(path.join(root, "package-lock.json"), "utf8"),
    ).toBe("lock");
    expect(await fs.readFile(path.join(root, "custom.ts"), "utf8")).toBe(
      "user",
    );
    expect(
      JSON.parse(
        await fs.readFile(
          path.join(root, ".cortex/templates/basic/baseline.json"),
          "utf8",
        ),
      ),
    ).toEqual(c);
    const same = planTemplateUpdate(
      c,
      c,
      await readTemplateFiles(root, Object.keys(c.files)),
    );
    expect(await applyTemplatePlan(root, same)).toEqual({
      status: "no-op",
      changed: 0,
      dependency: "not-requested",
    });
    expect(await recoverTemplateUpdate(root, "basic")).toEqual({
      status: "no-op",
      changed: 0,
      dependency: "not-requested",
    });
  });
  it("refuses conflicts and stale ownership/source before any apply", async () => {
    const a = baseline({ "x.ts": "old" }),
      c = baseline({ "x.ts": "new" }, "1.2.0"),
      root = await fixture(a, { "x.ts": "custom" });
    let before = await snapshot(root);
    await expect(
      applyTemplatePlan(
        root,
        planTemplateUpdate(a, c, local({ "x.ts": "custom" })),
      ),
    ).rejects.toThrow("TEMPLATE_CONFLICT");
    expect(await snapshot(root)).toEqual(before);
    const plan = planTemplateUpdate(a, c, local({ "x.ts": "old" }));
    await expect(applyTemplatePlan(root, plan)).rejects.toThrow(
      "TEMPLATE_PLAN_STALE",
    );
    expect(await snapshot(root)).toEqual(before);
    await fs.writeFile(
      path.join(root, ".cortex/templates/basic/baseline.json"),
      "tampered",
    );
    before = await snapshot(root);
    await expect(applyTemplatePlan(root, plan)).rejects.toThrow(
      "TEMPLATE_OWNERSHIP_MISMATCH",
    );
    expect(await snapshot(root)).toEqual(before);
  });
  it("rejects linked source/parents and missing ownership before writing outside the target", async () => {
    const a = baseline({ "src/x.ts": "old" }),
      c = baseline({ "src/x.ts": "new" }, "1.2.0"),
      root = await fixture(a, {});
    const outside = await fs.mkdtemp(
      path.join(process.env.HOME!, "template-outside-"),
    );
    roots.push(outside);
    await fs.writeFile(path.join(outside, "x.ts"), "sentinel");
    await fs.symlink(outside, path.join(root, "src"));
    await expect(readTemplateFiles(root, ["src/x.ts"])).rejects.toThrow(
      "TEMPLATE_PATH_KIND",
    );
    await expect(
      applyTemplatePlan(
        root,
        planTemplateUpdate(a, c, local({ "src/x.ts": "old" })),
      ),
    ).rejects.toThrow("TEMPLATE_PATH_KIND");
    expect(await fs.readFile(path.join(outside, "x.ts"), "utf8")).toBe(
      "sentinel",
    );
    await fs.unlink(path.join(root, ".cortex/templates/basic/baseline.json"));
    await expect(
      applyTemplatePlan(
        root,
        planTemplateUpdate(a, c, local({ "src/x.ts": "old" })),
      ),
    ).rejects.toThrow("TEMPLATE_OWNERSHIP_MISMATCH");
  });
  it("rolls back file/deletion/directory/baseline changes on explicit dependency failure and reports separate dependency uncertainty", async () => {
    const a = baseline({ "old.ts": "old" }),
      c = baseline({ "added/x.ts": "new" }, "1.2.0"),
      root = await fixture(a, { "old.ts": "old" });
    const before = await snapshot(root),
      install = jest.fn(async () => ({ exitCode: 1 }));
    try {
      await applyTemplatePlan(
        root,
        planTemplateUpdate(
          a,
          c,
          await readTemplateFiles(root, ["old.ts", "added/x.ts"]),
        ),
        { install },
      );
      throw new Error("unexpected success");
    } catch (error) {
      expect(error).toBeInstanceOf(TemplateApplyError);
      expect((error as TemplateApplyError).outcome).toEqual({
        status: "rolled-back",
        changed: 2,
        dependency: "failed-or-unknown",
      });
    }
    expect(install).toHaveBeenCalledTimes(1);
    expect(await snapshot(root)).toEqual(before);
  });
  it("reports successful explicit install separately and refuses pre-aborted apply with zero writes", async () => {
    const a = baseline({ x: "old" }),
      c = baseline({ x: "new" }, "1.2.0"),
      root = await fixture(a, { x: "old" });
    const plan = planTemplateUpdate(a, c, local({ x: "old" })),
      before = await snapshot(root),
      controller = new AbortController();
    controller.abort();
    await expect(
      applyTemplatePlan(root, plan, { signal: controller.signal }),
    ).rejects.toThrow("TEMPLATE_CANCELLED");
    expect(await snapshot(root)).toEqual(before);
    const install = jest.fn(async () => ({ exitCode: 0 }));
    expect(await applyTemplatePlan(root, plan, { install })).toMatchObject({
      status: "applied",
      dependency: "succeeded",
    });
    expect(install).toHaveBeenCalledTimes(1);
  });
  it("preserves concurrent edits, retains an incomplete rollback journal, and recovers without repeating dependency effects", async () => {
    const a = baseline({ x: "old" }),
      c = baseline({ x: "new" }, "1.2.0"),
      root = await fixture(a, { x: "old" });
    const install = jest.fn(async () => {
      await fs.writeFile(path.join(root, "x"), "concurrent-user-edit");
      throw new Error("private dependency error");
    });
    await expect(
      applyTemplatePlan(root, planTemplateUpdate(a, c, local({ x: "old" })), {
        install,
      }),
    ).rejects.toMatchObject({
      code: "TEMPLATE_APPLY_FAILED",
      outcome: {
        status: "rollback-incomplete",
        dependency: "failed-or-unknown",
      },
    });
    expect(await fs.readFile(path.join(root, "x"), "utf8")).toBe(
      "concurrent-user-edit",
    );
    await expect(
      applyTemplatePlan(root, planTemplateUpdate(a, c, local({ x: "old" }))),
    ).rejects.toThrow("TEMPLATE_RECOVERY_REQUIRED");
    expect(await recoverTemplateUpdate(root, "basic")).toMatchObject({
      status: "rollback-incomplete",
      dependency: "failed-or-unknown",
    });
    await fs.writeFile(path.join(root, "x"), "new");
    expect(await recoverTemplateUpdate(root, "basic")).toEqual({
      status: "rolled-back",
      changed: 1,
      dependency: "failed-or-unknown",
    });
    expect(await fs.readFile(path.join(root, "x"), "utf8")).toBe("old");
    expect(install).toHaveBeenCalledTimes(1);
    expect(await recoverTemplateUpdate(root, "basic")).toMatchObject({
      status: "no-op",
    });
  });
  it("recovers an interrupted applying journal and rejects malformed/unowned recovery input before effects", async () => {
    const a = baseline({ x: "old" }),
      c = baseline({ x: "new" }, "1.2.0"),
      root = await fixture(a, { x: "new", custom: "sentinel" });
    const journal = {
      format: 1,
      state: "applying",
      dependency: "not-requested",
      old: a,
      next: c,
      changes: [
        {
          path: "x",
          before: {
            content: bytes("old").toString("base64"),
            executable: false,
          },
          after: {
            content: bytes("new").toString("base64"),
            executable: false,
          },
        },
      ],
      createdDirectories: [],
    };
    const target = path.join(root, ".cortex/templates/basic/transaction.json");
    await fs.writeFile(target, stableJson(journal));
    expect(await recoverTemplateUpdate(root, "basic")).toMatchObject({
      status: "rolled-back",
      changed: 1,
    });
    expect(await fs.readFile(path.join(root, "x"), "utf8")).toBe("old");
    journal.changes[0].path = "custom";
    await fs.writeFile(target, stableJson(journal));
    const before = await snapshot(root);
    await expect(recoverTemplateUpdate(root, "basic")).rejects.toThrow(
      "TEMPLATE_JOURNAL_INVALID",
    );
    expect(await snapshot(root)).toEqual(before);
    await fs.writeFile(target, "not-json");
    await expect(recoverTemplateUpdate(root, "basic")).rejects.toThrow(
      "TEMPLATE_JOURNAL_INVALID",
    );
  });
  it("preflights a new file's conflicting parent before applying any earlier planned write", async () => {
    const a = baseline({ "a.ts": "old" }),
      c = baseline({ "a.ts": "new", "z/new.ts": "new" }, "1.2.0"),
      root = await fixture(a, { "a.ts": "old", z: "unowned-parent" });
    const plan = planTemplateUpdate(a, c, local({ "a.ts": "old" })),
      before = await snapshot(root);
    await expect(applyTemplatePlan(root, plan)).rejects.toThrow(
      "TEMPLATE_PATH_KIND",
    );
    expect(await snapshot(root)).toEqual(before);
  });
  it("advances only upstream baseline across a no-file-change update and still detects later divergence", async () => {
    const a = baseline({ x: "old" }),
      c = baseline({ x: "old" }, "1.2.0"),
      root = await fixture(a, { x: "local-edit" });
    expect(
      await applyTemplatePlan(
        root,
        planTemplateUpdate(a, c, local({ x: "local-edit" })),
      ),
    ).toMatchObject({ status: "applied", changed: 0 });
    expect(await fs.readFile(path.join(root, "x"), "utf8")).toBe("local-edit");
    const d = baseline({ x: "upstream-change" }, "1.3.0");
    expect(
      planTemplateUpdate(c, d, await readTemplateFiles(root, ["x"])).conflicts,
    ).toEqual([{ path: "x", reason: "divergent-change" }]);
  });
  it("clears a completed interrupted journal without replay or losing its known dependency result", async () => {
    const a = baseline({ x: "old" }),
      c = baseline({ x: "new" }, "1.2.0"),
      root = await fixture(c, { x: "new" });
    const target = path.join(root, ".cortex/templates/basic/transaction.json");
    await fs.writeFile(
      target,
      stableJson({
        format: 1,
        state: "complete",
        dependency: "succeeded",
        old: a,
        next: c,
        changes: [
          {
            path: "x",
            before: {
              content: bytes("old").toString("base64"),
              executable: false,
            },
            after: {
              content: bytes("new").toString("base64"),
              executable: false,
            },
          },
        ],
        createdDirectories: [],
      }),
    );
    expect(await recoverTemplateUpdate(root, "basic")).toEqual({
      status: "applied",
      changed: 1,
      dependency: "succeeded",
    });
    expect(await fs.readFile(path.join(root, "x"), "utf8")).toBe("new");
    await expect(fs.stat(target)).rejects.toMatchObject({ code: "ENOENT" });
  });
  it("persists explicit identical adoption without rewriting the adopted source bytes", async () => {
    const a = baseline({}),
      c = baseline({ x: "same" }, "1.2.0"),
      root = await fixture(a, { x: "same" });
    const before = await fs.stat(path.join(root, "x"), { bigint: true });
    const plan = planTemplateUpdate(a, c, local({ x: "same" }), {
      adoptIdentical: true,
    });
    expect(await applyTemplatePlan(root, plan)).toMatchObject({
      status: "applied",
      changed: 0,
    });
    expect(
      JSON.parse(
        await fs.readFile(
          path.join(root, ".cortex/templates/basic/baseline.json"),
          "utf8",
        ),
      ).adoptions,
    ).toEqual(["x"]);
    const after = await fs.stat(path.join(root, "x"), { bigint: true });
    expect(after.mtimeNs).toBe(before.mtimeNs);
    expect(await fs.readFile(path.join(root, "x"), "utf8")).toBe("same");
  });
});
