import { afterEach, describe, expect, it, jest } from "@jest/globals";
import * as fs from "node:fs/promises";
import path from "node:path";
import { gzipSync, gunzipSync } from "node:zlib";
import { Command } from "commander";
import {
  hashBytes,
  payloadHash,
  stableJson,
  decodePackageArchive,
  resolveTemplateCatalog,
  selectResolvedTemplate,
  resolveCatalogSource,
  resolveTemplateCandidate,
  prepareTemplateInit,
  applyPreparedTemplateInit,
  prepareTemplateUpdate,
  applyPreparedTemplateUpdate,
  readTemplateBaseline,
  satisfiesTemplateRange,
  createCatalogRegistry,
  installTemplateDependencies,
  runTemplateProcess,
  type TemplateCatalog,
  type TemplateExecutionOutcome,
} from "../../src/utils/templates/index.js";
import { registerTemplatesCommands } from "../../src/commands/templates.js";
const roots: string[] = [];
async function root(): Promise<string> {
  const home = process.env.CORTEX_TEST_HOME_ROOT;
  if (!home || home !== process.env.HOME)
    throw new Error("Explicit private HOME required");
  const value = await fs.mkdtemp(path.join(home, "catalog-test-"));
  roots.push(value);
  return value;
}
afterEach(async () => {
  for (const r of roots.splice(0))
    await fs.rm(r, { recursive: true, force: true });
});
const manifest = (version = "1.0.0") => ({
  name: "@cortexmemory/templates",
  version,
  type: "module",
  files: ["catalog.json", "payloads"],
});
function catalog(
  data: Record<string, string>,
  version = "1.1.0",
  backend = false,
): TemplateCatalog {
  const files = new Map(
    Object.entries(data).map(([n, v]) => [n, Buffer.from(v)]),
  );
  return {
    packageName: "@cortexmemory/templates",
    version: "1.0.0",
    schemaVersion: 1,
    apiVersion: 1,
    templates: [
      {
        id: "basic",
        version,
        payloadHash: payloadHash(files),
        manager: "npm",
        schemaVersion: 1,
        apiVersion: 1,
        provenance: "canonical/basic@1.1.0",
        compatibility: { sdk: "^0.37.0", convex: "1.46.0" },
        envNames: ["CONVEX_URL"],
        envExamples: [".env.local.example"],
        backend,
        graph: false,
        files: [...files].map(([name, bytes]) => ({
          path: name,
          kind: "file",
          hash: hashBytes(bytes),
          bytes: bytes.length,
          executable: false,
        })),
      },
    ],
  };
}
const app = (text = "old") => ({
  "package.json": JSON.stringify({
    name: "{{PROJECT_NAME}}",
    version: "1.1.0",
    private: true,
    dependencies: { "@cortexmemory/sdk": "^0.37.0", convex: "1.46.0" },
    scripts: { start: "node src/main.js" },
  }),
  "src/main.js": text,
  ".env.local.example": "CONVEX_URL=\n",
});
async function fixture(
  data = app(),
  version = "1.1.0",
  backend = false,
): Promise<string> {
  const r = await root();
  data = {
    ...data,
    "package.json": JSON.stringify({
      ...JSON.parse(data["package.json"]),
      version,
    }),
  };
  await fs.writeFile(path.join(r, "package.json"), JSON.stringify(manifest()));
  await fs.writeFile(
    path.join(r, "catalog.json"),
    JSON.stringify(catalog(data, version, backend)),
  );
  for (const [n, b] of Object.entries(data)) {
    const p = path.join(r, "payloads/basic", version, n);
    await fs.mkdir(path.dirname(p), { recursive: true });
    await fs.writeFile(p, b);
  }
  return r;
}
function archive(
  files: Record<string, Buffer | string>,
  kind: Record<string, string> = {},
): Buffer {
  const blocks: Buffer[] = [];
  for (const [n, v] of Object.entries(files)) {
    const b = Buffer.isBuffer(v) ? v : Buffer.from(v),
      h = Buffer.alloc(512),
      name = "package/" + n;
    if (Buffer.byteLength(name) > 100) {
      const split=name.lastIndexOf("/");
      if (Buffer.byteLength(name.slice(0,split)) > 155 || Buffer.byteLength(name.slice(split+1)) > 100) throw new Error("Fixture path exceeds ustar bounds");
      h.write(name.slice(split+1),0,100);h.write(name.slice(0,split),345,155);
    } else h.write(name,0,100);
    h.write("0000644\0", 100);
    h.write("0000000\0", 108);
    h.write("0000000\0", 116);
    h.write(b.length.toString(8).padStart(11, "0") + "\0", 124);
    h.write("00000000000\0", 136);
    h.fill(32, 148, 156);
    h.write(kind[n] ?? "0", 156);
    h.write("ustar\0", 257);
    h.write("00", 263);
    let checksum = 0;
    for (const x of h) checksum += x;
    h.write(checksum.toString(8).padStart(6, "0") + "\0 ", 148);
    blocks.push(h, b, Buffer.alloc((512 - (b.length % 512)) % 512));
  }
  blocks.push(Buffer.alloc(1024));
  return gzipSync(Buffer.concat(blocks));
}
async function packedFixture(source: string): Promise<string> {
  const files: Record<string, Buffer> = {};
  async function visit(dir: string, rel = "") {
    for (const n of (await fs.readdir(dir)).sort()) {
      const r = rel ? rel + "/" + n : n,
        p = path.join(dir, n),
        s = await fs.lstat(p);
      if (s.isDirectory()) await visit(p, r);
      else files[r] = await fs.readFile(p);
    }
  }
  await visit(source);
  const target = path.join(await root(), "catalog.tgz");
  await fs.writeFile(target, archive(files));
  return target;
}
async function snapshot(dir: string): Promise<Record<string, string>> {
  const result: Record<string, string> = {};
  async function visit(p: string, relative = "") {
    for (const name of (await fs.readdir(p)).sort()) {
      const n = relative ? relative + "/" + name : name,
        f = path.join(p, name),
        s = await fs.lstat(f);
      if (s.isDirectory()) {
        result[n + "/"] = "directory";
        await visit(f, n);
      } else
        result[n] = s.isSymbolicLink()
          ? "link"
          : "file:" + hashBytes(await fs.readFile(f));
    }
  }
  await visit(dir);
  return result;
}

describe("verified offline catalog resolution", () => {
  it("resolves exact directory/tarball identity and all payload bytes without extraction", async () => {
    const source = await fixture(),
      tar = await packedFixture(source),
      before = await snapshot(path.dirname(tar));
    for (const s of [source, tar]) {
      const resolved = await resolveTemplateCatalog(s, {
          catalogVersion: "1.0.0",
        }),
        chosen = selectResolvedTemplate(resolved, "basic", "1.1.0");
      expect(chosen.template.catalogHash).toBe(
        hashBytes(await fs.readFile(path.join(source, "catalog.json"))),
      );
      expect(chosen.files.get(".env.local.example")!.bytes.toString()).toBe(
        "CONVEX_URL=\n",
      );
      expect(chosen.files.size).toBe(3);
    }
    expect(await snapshot(path.dirname(tar))).toEqual(before);
  });
  it.each(["latest", "^1.0.0", "1.0", "1.0.1"])(
    "refuses unavailable/nonexact catalog %s without fallback",
    async (version) => {
      const r = await fixture();
      await expect(
        resolveTemplateCatalog(r, { catalogVersion: version }),
      ).rejects.toThrow(
        /TEMPLATE_(EXACT_VERSION_REQUIRED|VERSION_UNAVAILABLE)/,
      );
    },
  );
  it("requires exact template selection when multiple releases exist", async () => {
    const r = await fixture();
    const data = catalog(app());
    const second = { ...data.templates[0], version: "1.2.0" };
    data.templates.push(second);
    await fs.cp(
      path.join(r, "payloads/basic/1.1.0"),
      path.join(r, "payloads/basic/1.2.0"),
      { recursive: true },
    );
    await fs.writeFile(path.join(r, "catalog.json"), JSON.stringify(data));
    const resolved = await resolveTemplateCatalog(r);
    expect(() => selectResolvedTemplate(resolved, "basic")).toThrow(
      "TEMPLATE_EXACT_VERSION_REQUIRED",
    );
    expect(
      selectResolvedTemplate(resolved, "basic", "1.2.0").template.version,
    ).toBe("1.2.0");
    expect(() => selectResolvedTemplate(resolved, "basic", "1.3.0")).toThrow(
      "TEMPLATE_VERSION_UNAVAILABLE",
    );
  });
  it.each([
    "identity",
    "dependency",
    "lifecycle",
    "schema",
    "hash",
    "undeclared",
    "link",
    "manager",
  ])("refuses invalid %s source before project writes", async (flaw) => {
    const r = await fixture(),
      m = manifest() as Record<string, unknown>,
      data = catalog(app());
    if (flaw === "identity") m.name = "other";
    if (flaw === "dependency") m.dependencies = { sdk: "latest" };
    if (flaw === "lifecycle") m.scripts = { postinstall: "node unwanted.js" };
    if (flaw === "schema") data.schemaVersion = 2 as 1;
    if (flaw === "manager") data.templates[0].manager = "yarn" as "npm";
    await fs.writeFile(path.join(r, "package.json"), JSON.stringify(m));
    await fs.writeFile(path.join(r, "catalog.json"), JSON.stringify(data));
    const file = path.join(r, "payloads/basic/1.1.0/src/main.js");
    if (flaw === "hash") await fs.writeFile(file, "bad");
    if (flaw === "undeclared")
      await fs.writeFile(path.join(r, "payloads/private.txt"), "unowned");
    if (flaw === "link") {
      await fs.unlink(file);
      await fs.symlink(path.join(r, "package.json"), file);
    }
    await expect(resolveTemplateCatalog(r)).rejects.toThrow();
  });
  it("refuses later-template invalid payload even when the requested first template is valid", async () => {
    const r = await fixture(),
      data = catalog(app());
    data.templates.push({
      ...data.templates[0],
      id: "chat-sdk",
      manager: "pnpm",
      files: [
        {
          path: "../escape",
          kind: "file",
          hash: "a".repeat(64),
          bytes: 1,
          executable: false,
        },
      ],
    });
    await fs.writeFile(path.join(r, "catalog.json"), JSON.stringify(data));
    await expect(resolveTemplateCatalog(r)).rejects.toThrow(
      "TEMPLATE_PATH_PROTECTED",
    );
  });
  it.each(["1", "2", "3", "6"])(
    "rejects archive link/device/fifo kind %s in memory",
    (kind) => {
      expect(() =>
        decodePackageArchive(
          archive({ "catalog.json": "{}" }, { "catalog.json": kind }),
        ),
      ).toThrow("TEMPLATE_TAR_KIND");
    },
  );
  it.each(["../escape", "/absolute", "a\\b", "a/../b"])(
    "rejects archive path %s without extraction",
    (name) => {
      expect(() =>
        decodePackageArchive(archive({ [name]: "untrusted" })),
      ).toThrow(/TEMPLATE_(PACKAGE_PATH|TAR_ROOT)/);
    },
  );
  it("detects corrupt checksum and truncated archive", () => {
    const raw = Buffer.from("not gzip");
    expect(() => decodePackageArchive(raw)).toThrow("TEMPLATE_TAR_INVALID");
    const tar = gunzipSync(archive({ "README.md": "a" }));
    const corrupt = Buffer.from(tar);
    corrupt[0] ^= 1;
    expect(() => decodePackageArchive(gzipSync(corrupt))).toThrow(
      "TEMPLATE_TAR_CHECKSUM",
    );
    expect(() =>
      decodePackageArchive(gzipSync(tar.subarray(0, tar.length - 1024))),
    ).toThrow("TEMPLATE_TAR_TRUNCATED");
  });
  it("calls an explicit registry adapter only with the requested exact version", async () => {
    const r = await fixture(),
      registry = jest.fn(async () => r);
    expect(
      await resolveCatalogSource({ catalogVersion: "9.9.9" }, registry),
    ).toBe(r);
    expect(registry).toHaveBeenCalledWith("9.9.9");
    await expect(
      resolveCatalogSource({ catalogVersion: "latest" }, registry),
    ).rejects.toThrow("TEMPLATE_EXACT_VERSION_REQUIRED");
    expect(registry).toHaveBeenCalledTimes(1);
    await expect(
      resolveTemplateCatalog(r, { catalogVersion: "9.9.9" }),
    ).rejects.toThrow("TEMPLATE_VERSION_UNAVAILABLE");
  });
  it.each([
    ["0.37.1", "^0.37.0", true],
    ["0.38.0", "^0.37.0", false],
    ["1.46.0", ">=1.31.6 <2.0.0", true],
    ["1.30.0", ">=1.31.6", false],
    ["1.46.0", "latest", false],
  ] as const)("matches stable compatibility %s %s => %s", (v, r, e) =>
    expect(satisfiesTemplateRange(v, r)).toBe(e),
  );
});
describe("ownership orchestration and command outcomes", () => {
  it("dry-run creates no project/metadata/env and never constructs integration/install", async () => {
    const source = await fixture(app(), "1.1.0", true),
      parent = await root(),
      target = path.join(parent, "new-app"),
      before = await snapshot(parent),
      outputs: unknown[] = [],
      integration = jest.fn(),
      install = jest.fn();
    const p = new Command().exitOverride();
    registerTemplatesCommands(p, {
      output: (v) => outputs.push(v),
      integration,
      install,
    });
    await p.parseAsync(
      [
        "templates",
        "init",
        target,
        "--template",
        "basic",
        "--templates-package",
        source,
        "--dry-run",
        "--yes",
      ],
      { from: "user" },
    );
    expect(await snapshot(parent)).toEqual(before);
    expect(outputs).toMatchObject([
      {
        status: "dry-run",
        dependency: "not-requested",
        integration: "not-requested",
      },
    ]);
    expect(integration).not.toHaveBeenCalled();
    expect(install).not.toHaveBeenCalled();
  });
  it("atomically initializes rendered ownership and repeated init preserves local edits without writes", async () => {
    const source = await fixture(),
      parent = await root(),
      target = path.join(parent, "my-app"),
      prepared = await prepareTemplateInit(target, "basic", {
        templatesPackage: source,
      });
    const first = await applyPreparedTemplateInit(prepared);
    expect(first.status).toBe("applied");
    expect(
      JSON.parse(await fs.readFile(path.join(target, "package.json"), "utf8"))
        .name,
    ).toBe("my-app");
    expect(
      (
        await fs.stat(
          path.join(target, ".cortex/templates/basic/baseline.json"),
        )
      ).mode & 0o777,
    ).toBe(0o600);
    await fs.writeFile(path.join(target, "src/main.js"), "custom edit");
    const before = await snapshot(target),
      again = await prepareTemplateInit(target, "basic", {
        templatesPackage: source,
      });
    expect((await applyPreparedTemplateInit(again)).status).toBe("no-op");
    expect(await snapshot(target)).toEqual(before);
  });
  it("existing unowned destination and wrong ownership refuse without replacing user files", async () => {
    const source = await fixture(),
      target = await root();
    await fs.writeFile(path.join(target, "user.txt"), "keep");
    const before = await snapshot(target);
    await expect(
      prepareTemplateInit(target, "basic", { templatesPackage: source }),
    ).rejects.toThrow("TEMPLATE_DESTINATION_EXISTS");
    expect(await snapshot(target)).toEqual(before);
  });
  it("explicit candidates validate identity/capability/version and rendered bytes record the actual override", async () => {
    const source = await fixture(),
      candidate = await root();
    await fs.writeFile(
      path.join(candidate, "package.json"),
      JSON.stringify({ name: "@cortexmemory/sdk", version: "0.37.0" }),
    );
    for (const n of [
      "dist/index.js",
      "dist/index.d.ts",
      "convex-dev/schema.ts",
      "convex-dev/lib/referenceLifecycle.ts",
    ]) {
      await fs.mkdir(path.dirname(path.join(candidate, n)), {
        recursive: true,
      });
      await fs.writeFile(path.join(candidate, n), "capability bytes");
    }
    const result = await resolveTemplateCandidate(candidate, "sdk", "^0.37.0");
    expect(result.specifier).toBe("file:" + candidate);
    const target = path.join(await root(), "app"),
      prepared = await prepareTemplateInit(target, "basic", {
        templatesPackage: source,
        sdkPackage: candidate,
      });
    const rendered = JSON.parse(
      Buffer.from(
        prepared.baseline.files["package.json"].content,
        "base64",
      ).toString(),
    );
    expect(rendered.dependencies["@cortexmemory/sdk"]).toBe(result.specifier);
    await applyPreparedTemplateInit(prepared);
    expect((await prepareTemplateInit(target,"basic",{templatesPackage:source,sdkPackage:candidate})).existingPlan?.changes).toEqual([]);
    expect((await prepareTemplateUpdate(target,{templatesPackage:source,sdkPackage:candidate,to:"1.1.0"})).plan.conflicts).toEqual([]);
    await fs.writeFile(
      path.join(candidate, "package.json"),
      JSON.stringify({ name: "@cortexmemory/sdk", version: "0.36.0" }),
    );
    await expect(
      resolveTemplateCandidate(candidate, "sdk", "^0.37.0"),
    ).rejects.toThrow("TEMPLATE_COMPATIBILITY_REFUSED");
    await fs.writeFile(
      path.join(candidate, "package.json"),
      JSON.stringify({ name: "other", version: "0.37.0" }),
    );
    await expect(
      resolveTemplateCandidate(candidate, "sdk", "^0.37.0"),
    ).rejects.toThrow("TEMPLATE_CANDIDATE_IDENTITY");
  });
  it("preflights all divergent changes and unknown/unowned data before any installer/backend effect", async () => {
    const source = await fixture(),
      target = path.join(await root(), "app");
    await applyPreparedTemplateInit(
      await prepareTemplateInit(target, "basic", { templatesPackage: source }),
    );
    const next = await fixture(app("new"), "1.2.0");
    await fs.writeFile(path.join(target, "src/main.js"), "user edit");
    const before = await snapshot(target),
      prepared = await prepareTemplateUpdate(target, {
        templatesPackage: next,
        to: "1.2.0",
      }),
      preflight = jest.fn(),
      install = jest.fn();
    expect(prepared.plan.conflicts).toContainEqual({
      path: "src/main.js",
      reason: "divergent-change",
    });
    await expect(
      applyPreparedTemplateUpdate(prepared, {
        install,
        integration: { preflight },
      }),
    ).rejects.toThrow("TEMPLATE_CONFLICT");
    expect(preflight).not.toHaveBeenCalled();
    expect(install).not.toHaveBeenCalled();
    expect(await snapshot(target)).toEqual(before);
  });
  it("updates exact new owned files, preserves custom identity/scripts/env, and no-op is idempotent", async () => {
    const source = await fixture(),
      target = path.join(await root(), "app");
    await applyPreparedTemplateInit(
      await prepareTemplateInit(target, "basic", { templatesPackage: source }),
    );
    const packagePath = path.join(target, "package.json"),
      pkg = JSON.parse(await fs.readFile(packagePath, "utf8"));
    pkg.name = "user-name";
    pkg.version = "7.0.0";
    pkg.scripts.custom = "echo keep";
    await fs.writeFile(packagePath, JSON.stringify(pkg));
    await fs.writeFile(path.join(target, ".env.local"), "PRIVATE=keep\n");
    const next = await fixture(app("new"), "1.2.0");
    const prepared = await prepareTemplateUpdate(target, {
      templatesPackage: next,
      to: "1.2.0",
    });
    expect(prepared.plan.conflicts).toEqual([]);
    expect((await applyPreparedTemplateUpdate(prepared)).status).toBe(
      "applied",
    );
    expect(await fs.readFile(path.join(target, "src/main.js"), "utf8")).toBe(
      "new",
    );
    expect(JSON.parse(await fs.readFile(packagePath, "utf8"))).toMatchObject({
      name: "user-name",
      version: "7.0.0",
      scripts: { custom: "echo keep" },
    });
    expect(await fs.readFile(path.join(target, ".env.local"), "utf8")).toBe(
      "PRIVATE=keep\n",
    );
    expect(
      (await readTemplateBaseline(target, "basic"))!.identity.version,
    ).toBe("1.2.0");
    expect(
      (
        await applyPreparedTemplateUpdate(
          await prepareTemplateUpdate(target, {
            templatesPackage: next,
            to: "1.2.0",
          }),
        )
      ).status,
    ).toBe("no-op");
  });
  it("update dependency failure rolls back owned payload/baseline and reports unknown dependency effects", async () => {
    const source = await fixture(),
      target = path.join(await root(), "app");
    await applyPreparedTemplateInit(
      await prepareTemplateInit(target, "basic", { templatesPackage: source }),
    );
    const before = await snapshot(target),
      next = await fixture(app("new"), "1.2.0"),
      prepared = await prepareTemplateUpdate(target, {
        templatesPackage: next,
        to: "1.2.0",
      });
    await expect(
      applyPreparedTemplateUpdate(prepared, {
        install: async () => ({ exitCode: 7 }),
      }),
    ).rejects.toMatchObject({
      outcome: { status: "rolled-back", dependency: "failed-or-unknown" },
    });
    const after = await snapshot(target);
    expect(after[".cortex/templates/basic/operation.json"]).toMatch(/^file:/);
    expect((await fs.stat(path.join(target,".cortex/templates/basic/operation.json"))).mode & 0o777).toBe(0o600);
    delete after[".cortex/templates/basic/operation.json"];
    expect(after).toEqual(before);
    expect(JSON.parse(await fs.readFile(path.join(target,".cortex/templates/basic/operation.json"),"utf8")))
      .toMatchObject({status:"rolled-back",dependency:"failed-or-unknown"});
    await expect(applyPreparedTemplateUpdate(prepared)).rejects.toThrow("TEMPLATE_OPERATION_RECONCILIATION_REQUIRED");
  });
  it("required integration preflight refusal has zero project effects", async () => {
    const source = await fixture(app(), "1.1.0", true),
      parent = await root(),
      target = path.join(parent, "app"),
      prepared = await prepareTemplateInit(target, "basic", {
        templatesPackage: source,
      }),
      before = await snapshot(parent);
    await expect(applyPreparedTemplateInit(prepared)).rejects.toThrow(
      "TEMPLATE_INTEGRATION_REQUIRED",
    );
    await expect(
      applyPreparedTemplateInit(prepared, {
        integration: {
          preflight: async () => {
            throw new Error("known before effects");
          },
        },
      }),
    ).rejects.toThrow("known before effects");
    expect(await snapshot(parent)).toEqual(before);
  });
  it("new-project post-publish install failure is nonzero partial and retains truthful recoverable ownership", async () => {
    const source = await fixture(),
      target = path.join(await root(), "app"),
      prepared = await prepareTemplateInit(target, "basic", {
        templatesPackage: source,
      });
    await expect(
      applyPreparedTemplateInit(prepared, {
        install: async () => ({ exitCode: 9 }),
      }),
    ).rejects.toMatchObject({
      outcome: { status: "partial", dependency: "failed-or-unknown" },
    });
    expect(
      (await readTemplateBaseline(target, "basic"))!.identity.version,
    ).toBe("1.1.0");
    expect(await fs.readFile(path.join(target, "src/main.js"), "utf8")).toBe(
      "old",
    );
  });
  it("command registry contains exactly three leaves and forwards exact selectors to the matching manager", async () => {
    const source = await fixture(),
      parent = await root(),
      target = path.join(parent, "app"),
      outputs: unknown[] = [],
      install = jest.fn(async () => ({ exitCode: 0 })),
      p = new Command().exitOverride();
    const group = registerTemplatesCommands(p, {
      output: (v) => outputs.push(v),
      install,
    });
    expect(group.commands.map((c) => c.name())).toEqual([
      "list",
      "init",
      "update",
    ]);
    await p.parseAsync(
      [
        "templates",
        "--catalog-version",
        "9.0.0",
        "init",
        target,
        "--catalog-version",
        "1.0.0",
        "--template",
        "basic",
        "--template-version",
        "1.1.0",
        "--templates-package",
        source,
        "--yes",
      ],
      { from: "user" },
    );
    expect(install).toHaveBeenCalledWith(target, "npm");
    expect(outputs).toMatchObject([
      {
        status: "applied",
        dependency: "succeeded",
        identity: { catalogVersion: "1.0.0", version: "1.1.0" },
      },
    ]);
  });
  it("command emits partial result then rejects instead of reporting a completed install", async () => {
    const source = await fixture(),
      target = path.join(await root(), "app"),
      outputs: unknown[] = [],
      p = new Command().exitOverride();
    registerTemplatesCommands(p, {
      output: (v) => outputs.push(v),
      install: async () => ({ exitCode: 4 }),
    });
    await expect(
      p.parseAsync(
        [
          "templates",
          "init",
          target,
          "--template",
          "basic",
          "--templates-package",
          source,
        ],
        { from: "user" },
      ),
    ).rejects.toThrow("TEMPLATE_INTEGRATION_FAILED_OR_UNKNOWN");
    expect(outputs).toMatchObject([
      { status: "partial", dependency: "failed-or-unknown" },
    ]);
  });
  it("command list is an offline observation and update missing ownership refuses", async () => {
    const source = await fixture(),
      outputs: unknown[] = [],
      p = new Command().exitOverride();
    registerTemplatesCommands(p, { output: (v) => outputs.push(v) });
    await p.parseAsync(["templates", "list", "--templates-package", source], {
      from: "user",
    });
    expect(outputs).toMatchObject([
      [
        {
          id: "basic",
          version: "1.1.0",
          catalogVersion: "1.0.0",
          manager: "npm",
        },
      ],
    ]);
    await expect(
      prepareTemplateUpdate(await root(), {
        templatesPackage: source,
        to: "1.2.0",
      }),
    ).rejects.toThrow("TEMPLATE_OWNERSHIP_REQUIRED");
  });
});

describe("exact registry and matching manager execution", () => {
  it("caches only a verified exact release outside projects and reuses it offline", async () => {
    const source = await fixture(),
      packed = await packedFixture(source),
      cache = path.join(await root(), "cache");
    const run = jest.fn(
      async (command: string, args: string[], cwd: string) => {
        expect(command).toBe("npm");
        expect(args.slice(0, 4)).toEqual([
          "pack",
          "@cortexmemory/templates@1.0.0",
          "--ignore-scripts",
          "--json",
        ]);
        expect(args).toContain(path.join(cwd, "npm-cache"));
        await fs.copyFile(packed, path.join(cwd, "release.tgz"));
        return {
          exitCode: 0,
          stdout: JSON.stringify([{ filename: "release.tgz" }]),
        };
      },
    );
    const registry = createCatalogRegistry({ cacheRoot: cache, run });
    const selected = await registry("1.0.0");
    expect(selected).toBe(path.join(cache, "1.0.0.tgz"));
    expect((await resolveTemplateCatalog(selected)).packageVersion).toBe(
      "1.0.0",
    );
    expect(await registry("1.0.0")).toBe(selected);
    expect(run).toHaveBeenCalledTimes(1);
    expect(await fs.readdir(cache)).toEqual(["1.0.0.tgz"]);
  });
  it("failed registry selection never publishes or leaves a temporary download", async () => {
    const cache = path.join(await root(), "cache"),
      run = jest.fn(async () => ({
        exitCode: 1,
        stdout: "private error omitted",
      }));
    await expect(
      createCatalogRegistry({ cacheRoot: cache, run })("1.0.0"),
    ).rejects.toThrow("TEMPLATE_VERSION_UNAVAILABLE");
    expect(await fs.readdir(cache)).toEqual([]);
  });
  it("registry path and release mismatch refuse before cache publication", async () => {
    const packed = await packedFixture(await fixture()),
      cache = path.join(await root(), "cache");
    await expect(
      createCatalogRegistry({
        cacheRoot: cache,
        run: async () => ({
          exitCode: 0,
          stdout: JSON.stringify([{ filename: "../escape.tgz" }]),
        }),
      })("1.0.0"),
    ).rejects.toThrow("TEMPLATE_REGISTRY_RESULT_INVALID");
    await expect(
      createCatalogRegistry({
        cacheRoot: cache,
        run: async (_command, _args, cwd) => {
          await fs.copyFile(packed, path.join(cwd, "release.tgz"));
          return {
            exitCode: 0,
            stdout: JSON.stringify([{ filename: "release.tgz" }]),
          };
        },
      })("1.2.0"),
    ).rejects.toThrow("TEMPLATE_VERSION_UNAVAILABLE");
    expect(await fs.readdir(cache)).toEqual([]);
  });
  it("command dry-run cannot construct a registry download or dependency installation", async () => {
    const parent = await root(),
      before = await snapshot(parent),
      registry = jest.fn(async () => {
        throw new Error("must not execute");
      }),
      install = jest.fn(async () => ({ exitCode: 0 })),
      p = new Command().exitOverride();
    registerTemplatesCommands(p, { registry, install, output: () => {} });
    await expect(
      p.parseAsync(
        [
          "templates",
          "init",
          path.join(parent, "project"),
          "--template",
          "basic",
          "--catalog-version",
          "9.9.9",
          "--dry-run",
        ],
        { from: "user" },
      ),
    ).rejects.toThrow("TEMPLATE_CATALOG_SOURCE_UNAVAILABLE");
    expect(registry).not.toHaveBeenCalled();
    expect(install).not.toHaveBeenCalled();
    expect(await snapshot(parent)).toEqual(before);
  });
  it.each(["npm", "pnpm"] as const)(
    "invokes only the declared %s manager and reports its actual nonzero result",
    async (manager) => {
      const project = await root(),
        run = jest.fn(async () => ({ exitCode: 7, stdout: "" }));
      const result = await installTemplateDependencies(project, manager, run);
      expect(result).toEqual({ exitCode: 7 });
      expect(run).toHaveBeenCalledWith(
        manager,
        manager === "npm"
          ? [
              "install",
              "--ignore-scripts",
              "--workspaces=false",
              "--no-audit",
              "--no-fund",
            ]
          : ["install", "--ignore-scripts", "--no-frozen-lockfile"],
        project,
      );
    },
  );
  it.each([
    ["npm", "pnpm-lock.yaml"],
    ["pnpm", "package-lock.json"],
  ] as const)(
    "%s refuses the existing %s manager conflict before executing",
    async (manager, lock) => {
      const project = await root();
      await fs.writeFile(path.join(project, lock), "unchanged");
      const before = await snapshot(project),
        run = jest.fn(async () => ({ exitCode: 0, stdout: "" }));
      await expect(
        installTemplateDependencies(project, manager, run),
      ).rejects.toThrow("TEMPLATE_MANAGER_MIGRATION_REQUIRED");
      expect(run).not.toHaveBeenCalled();
      expect(await snapshot(project)).toEqual(before);
    },
  );
  it("joins an actual private finite child, returns exact stdout, and removes signal listeners", async () => {
    const before = [
        process.listenerCount("SIGINT"),
        process.listenerCount("SIGTERM"),
      ],
      project = await root();
    expect(
      await runTemplateProcess(
        process.execPath,
        [
          "--input-type=module",
          "-e",
          "process.stdout.write('selected');process.stderr.write('not published');process.exitCode=3",
        ],
        project,
      ),
    ).toEqual({ exitCode: 3, stdout: "selected" });
    expect([
      process.listenerCount("SIGINT"),
      process.listenerCount("SIGTERM"),
    ]).toEqual(before);
  });
  it("actual executable-not-found closes and refuses with a fixed diagnostic", async () => {
    const before = [
      process.listenerCount("SIGINT"),
      process.listenerCount("SIGTERM"),
    ];
    await expect(
      runTemplateProcess(path.join(await root(), "absent"), [], await root()),
    ).rejects.toThrow("TEMPLATE_PROCESS_FAILED_OR_UNKNOWN");
    expect([
      process.listenerCount("SIGINT"),
      process.listenerCount("SIGTERM"),
    ]).toEqual(before);
  });
});

describe("repeated ownership operations", () => {
  it("repeated init and same-version update do not construct or repeat dependency/backend/graph effects", async () => {
    const source = await fixture(app(), "1.1.0", true),
      target = path.join(await root(), "project"),
      prepared = await prepareTemplateInit(target, "basic", {
        templatesPackage: source,
      });
    await applyPreparedTemplateInit(prepared, {
      integration: { preflight: async () => ({ apply: async () => {} }) },
    });
    const before = await snapshot(target),
      integration = jest.fn(() => {
        throw new Error("must not construct");
      }),
      install = jest.fn(async () => ({ exitCode: 0 })),
      outputs: unknown[] = [];
    const p = new Command().exitOverride();
    registerTemplatesCommands(p, {
      integration,
      install,
      output: (value) => outputs.push(value),
    });
    await p.parseAsync(
      [
        "templates",
        "init",
        target,
        "--template",
        "basic",
        "--templates-package",
        source,
      ],
      { from: "user" },
    );
    const q = new Command().exitOverride();
    registerTemplatesCommands(q, {
      integration,
      install,
      output: (value) => outputs.push(value),
    });
    await q.parseAsync(
      [
        "templates",
        "update",
        target,
        "--to",
        "1.1.0",
        "--templates-package",
        source,
      ],
      { from: "user" },
    );
    expect(outputs).toMatchObject([
      {
        status: "no-op",
        dependency: "not-requested",
        integration: "not-requested",
      },
      {
        status: "no-op",
        dependency: "not-requested",
        integration: "not-requested",
      },
    ]);
    expect(integration).not.toHaveBeenCalled();
    expect(install).not.toHaveBeenCalled();
    expect(await snapshot(target)).toEqual(before);
  });
  it("pre-aborted new init leaves no project, temporary stage, metadata or dependency effects", async () => {
    const source = await fixture(),
      parent = await root(),
      target = path.join(parent, "project"),
      prepared = await prepareTemplateInit(target, "basic", {
        templatesPackage: source,
      }),
      before = await snapshot(parent),
      controller = new AbortController(),
      install = jest.fn(async () => ({ exitCode: 0 }));
    controller.abort();
    await expect(
      applyPreparedTemplateInit(prepared, {
        signal: controller.signal,
        install,
      }),
    ).rejects.toThrow("TEMPLATE_CANCELLED");
    expect(install).not.toHaveBeenCalled();
    expect(await snapshot(parent)).toEqual(before);
  });
});

describe("catalog capability admission", () => {
  it("a graph-capable payload does not implicitly enable graph services", async () => {
    const source = await fixture(),
      file = path.join(source, "catalog.json"),
      data = JSON.parse(await fs.readFile(file, "utf8"));
    data.templates[0].graph = true;
    await fs.writeFile(file, JSON.stringify(data));
    const target = path.join(await root(), "project"),
      prepared = await prepareTemplateInit(target, "basic", {
        templatesPackage: source,
      });
    expect(prepared.template.graph).toBe(true);
    const result = await applyPreparedTemplateInit(prepared);
    expect(result.integration).toBe("not-required");
    expect(await fs.readFile(path.join(target, "src/main.js"), "utf8")).toBe(
      "old",
    );
  });
  it("missing rendered app manifest refuses without creating a project", async () => {
    const source = await fixture(),
      file = path.join(source, "catalog.json"),
      data = JSON.parse(await fs.readFile(file, "utf8"));
    data.templates[0].files = data.templates[0].files.filter(
      (row: { path: string }) => row.path !== "package.json",
    );
    await fs.unlink(path.join(source, "payloads/basic/1.1.0/package.json"));
    data.templates[0].payloadHash = payloadHash(
      new Map([
        ["src/main.js", Buffer.from("old")],
        [".env.local.example", Buffer.from("CONVEX_URL=\n")],
      ]),
    );
    await fs.writeFile(file, JSON.stringify(data));
    const parent = await root(),
      before = await snapshot(parent);
    await expect(
      prepareTemplateInit(path.join(parent, "project"), "basic", {
        templatesPackage: source,
      }),
    ).rejects.toThrow("TEMPLATE_PACKAGE_INCOMPLETE");
    expect(await snapshot(parent)).toEqual(before);
  });
});

describe("npm-sensitive canonical storage mappings",()=>{
  it("renders .gitignore and next-env bytes from fixed content aliases and rejects forged mappings before effects",async()=>{
    const source=await fixture({...app(),".gitignore":"node_modules\n","next-env.d.ts":"/// <reference types=\"next\" />\n"});
    const file=path.join(source,"catalog.json"),data=JSON.parse(await fs.readFile(file,"utf8"));
    for(const entry of data.templates[0].files){if([".gitignore","next-env.d.ts"].includes(entry.path)){
      entry.storagePath=`__catalog_files/${entry.hash}.bin`;
      const directory=path.join(source,"payloads/basic/1.1.0");await fs.mkdir(path.join(directory,"__catalog_files"),{recursive:true});await fs.rename(path.join(directory,entry.path),path.join(directory,entry.storagePath));
    }}
    await fs.writeFile(file,JSON.stringify(data));
    const packed=await packedFixture(source),chosen=selectResolvedTemplate(await resolveTemplateCatalog(packed),"basic","1.1.0");
    expect(chosen.files.get(".gitignore")?.bytes.toString()).toBe("node_modules\n");expect(chosen.files.has("next-env.d.ts")).toBe(true);
    const parent=await root(),target=path.join(parent,"app");await applyPreparedTemplateInit(await prepareTemplateInit(target,"basic",{templatesPackage:packed}));
    expect(await fs.readFile(path.join(target,".gitignore"),"utf8")).toBe("node_modules\n");
    expect(await fs.readFile(path.join(target,"next-env.d.ts"),"utf8")).toBe('/// <reference types="next" />\n');
    const entry=data.templates[0].files.find((f:{path:string})=>f.path===".gitignore");entry.storagePath="../escape";await fs.writeFile(file,JSON.stringify(data));
    await expect(resolveTemplateCatalog(source)).rejects.toThrow("TEMPLATE_STORAGE_MAPPING_INVALID");
  });
});

describe("final runtime dependency compatibility", () => {
  it.each([
    ["@cortexmemory/sdk", "^0.36.0"], ["@cortexmemory/sdk", null],
    ["convex", "1.45.0"], ["convex", null],
    ["@cortexmemory/vercel-ai-provider", "^0.36.0"], ["@cortexmemory/vercel-ai-provider", null],
  ] as const)("unchanged upstream cannot retain incompatible or deleted %s (%s) on update/repeated init", async (name,spec) => {
    const data=app(),manifest=JSON.parse(data["package.json"]);
    if(name.includes("provider")) manifest.dependencies[name]="^0.37.0";
    data["package.json"]=JSON.stringify(manifest);
    const a=await fixture(data),b=await fixture(data,"1.2.0");
    if(name.includes("provider"))for(const source of [a,b]) {
      const file=path.join(source,"catalog.json"),value=JSON.parse(await fs.readFile(file,"utf8"));
      value.templates[0].compatibility.provider="^0.37.0";await fs.writeFile(file,JSON.stringify(value));
    }
    const target=path.join(await root(),"app");await applyPreparedTemplateInit(await prepareTemplateInit(target,"basic",{templatesPackage:a}));
    const file=path.join(target,"package.json"),local=JSON.parse(await fs.readFile(file,"utf8"));
    if(spec===null)delete local.dependencies[name];else local.dependencies[name]=spec;
    await fs.writeFile(file,JSON.stringify(local));const before=await snapshot(target);
    const install=jest.fn(async()=>({exitCode:0})),apply=jest.fn(async()=>undefined),integration=jest.fn(()=>({preflight:async()=>({apply})}));
    for(const dryRun of [false,true]) {
      const p=new Command().exitOverride();registerTemplatesCommands(p,{install,integration,output:()=>undefined});
      await expect(p.parseAsync(["node","test","templates","update",target,"--to","1.2.0","--templates-package",b,...(dryRun?["--dry-run"]:[])])).rejects.toThrow(/TEMPLATE_RUNTIME_DEPENDENCY_(MISSING|INCOMPATIBLE)/);
      expect(await snapshot(target)).toEqual(before);
    }
    await expect(prepareTemplateInit(target,"basic",{templatesPackage:a})).rejects.toThrow(/TEMPLATE_RUNTIME_DEPENDENCY_(MISSING|INCOMPATIBLE)/);
    expect(install).not.toHaveBeenCalled();expect(integration).not.toHaveBeenCalled();expect(apply).not.toHaveBeenCalled();
  });
  it("compatible runtime overrides and unrelated user dependency overrides remain unchanged",async()=>{
    const a=await fixture(),b=await fixture(app(),"1.2.0"),target=path.join(await root(),"app");
    await applyPreparedTemplateInit(await prepareTemplateInit(target,"basic",{templatesPackage:a}));
    const file=path.join(target,"package.json"),local=JSON.parse(await fs.readFile(file,"utf8"));
    local.dependencies["@cortexmemory/sdk"]="~0.37.0";local.dependencies.unrelated="^0.1.0";
    await fs.writeFile(file,JSON.stringify(local));
    const prepared=await prepareTemplateUpdate(target,{templatesPackage:b,to:"1.2.0"});expect(prepared.plan.conflicts).toEqual([]);
    await applyPreparedTemplateUpdate(prepared);const result=JSON.parse(await fs.readFile(file,"utf8"));
    expect(result.dependencies["@cortexmemory/sdk"]).toBe("~0.37.0");expect(result.dependencies.unrelated).toBe("^0.1.0");
    expect((await prepareTemplateInit(target,"basic",{templatesPackage:b})).existingPlan?.changes).toEqual([]);
  });
});
