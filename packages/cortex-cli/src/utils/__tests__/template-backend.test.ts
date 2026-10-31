import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  afterEach,
  jest,
} from "@jest/globals";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createLegacySdkFixture } from "./legacy-backend-fixture.js";
import {
  planTemplateBackend,
  transformCanonicalSdk,
  rewriteRegistrationImport,
  REGISTRATION_SHIM,
  SCHEMA_COMPOSER,
  isRecognizedSchemaComposerHash,
  expectedSdkRegistrations,
  expectedAppRegistrations,
  expectedAppModules,
  isRecognizedTransformContractHash,
  isRecognizedAppContractHash,
  appContractHash,
  TRANSFORM_CONTRACT_HASH,
  type CanonicalTemplate,
} from "../template-backend.js";
import {
  applyBackendPlan,
  planBackendSync,
  discoverBackendFiles,
  hashBytes,
  BACKEND_MANIFEST,
  type ComposedBackendOwnership,
} from "../schema-sync.js";
const core = fileURLToPath(new URL("../../../../../", import.meta.url));
let sdk: string;
const roots: string[] = [];
function temp(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "cortex-task13-"));
  roots.push(root);
  return root;
}
function tree(root: string): Record<string, string> {
  const files: Record<string, string> = {};
  const walk = (dir: string) => {
    for (const item of fs.readdirSync(path.join(root, dir), {
      withFileTypes: true,
    })) {
      const name = dir ? `${dir}/${item.name}` : item.name;
      if (item.isDirectory()) {
        files[`${name}/`] = "directory";
        walk(name);
      } else
        files[name] = item.isSymbolicLink()
          ? `link:${fs.readlinkSync(path.join(root, name))}`
          : hashBytes(fs.readFileSync(path.join(root, name)));
    }
  };
  walk("");
  return files;
}
function fixture(
  template: CanonicalTemplate = "chat-sdk",
  directory = "backend/functions",
): string {
  const project = temp();
  const canonical =
    template === "chat-sdk"
      ? "packages/cortex-templates/payloads/chat-sdk/1.2.0"
      : "packages/cortex-templates/payloads/vercel-ai-quickstart/1.2.0";
  fs.cpSync(
    path.join(core, canonical, "convex"),
    path.join(project, directory),
    {
      recursive: true,
      filter: (file) => !file.split(path.sep).includes("_generated"),
    },
  );
  fs.writeFileSync(
    path.join(project, "convex.json"),
    JSON.stringify({ functions: directory, settings: { preserve: true } }),
  );
  fs.mkdirSync(path.join(project, directory, "_generated"));
  fs.writeFileSync(
    path.join(project, directory, "_generated/api.ts"),
    "generated sentinel",
  );
  fs.writeFileSync(
    path.join(project, directory, "auth.config.ts"),
    "export default { providers: [] };\n",
  );
  fs.writeFileSync(
    path.join(project, directory, "crons.ts"),
    "// app-owned cron sentinel\n",
  );
  return project;
}
function readManifest(project: string): ComposedBackendOwnership {
  return JSON.parse(
    fs.readFileSync(path.join(project, BACKEND_MANIFEST), "utf8"),
  );
}
function ledgerHash(files: Record<string, string>): string {
  return hashBytes(
    Object.keys(files)
      .sort((a, b) => a.localeCompare(b))
      .map((name) => `${name}:${files[name]}`)
      .join("\n"),
  );
}
function saveManifest(project: string, value: ComposedBackendOwnership): void {
  value.sdk.sourceHash = ledgerHash(
    Object.fromEntries(
      Object.entries(value.sources).map(([name, entry]) => [
        name,
        entry.sourceHash,
      ]),
    ),
  );
  value.outputHash = ledgerHash(value.files);
  fs.writeFileSync(path.join(project, BACKEND_MANIFEST), JSON.stringify(value));
}
beforeAll(() => {
  if (
    !process.env.CORTEX_TEST_HOME_ROOT ||
    fs.realpathSync(os.homedir()) !==
      fs.realpathSync(process.env.CORTEX_TEST_HOME_ROOT)
  )
    throw new Error("Externally isolated HOME required before imports");
  sdk = createLegacySdkFixture();
});
afterAll(() => fs.rmSync(sdk, { recursive: true, force: true }));
afterEach(() => {
  jest.restoreAllMocks();
  for (const root of roots.splice(0))
    fs.rmSync(root, { recursive: true, force: true });
});
describe("immutable 1.2 legacy template composition against exact incoming SDK source", () => {
  it.each(["chat-sdk", "vercel-ai-quickstart"] as const)(
    "assembles %s with separate ownership, preserves sentinels and is idempotent",
    (template) => {
      const project = fixture(template),
        before = tree(project),
        plan = planTemplateBackend(project, sdk, template);
      expect(plan.conflicts).toEqual([]);
      expect(plan.ownership.format).toBe(2);
      expect(plan.files["schema.ts"].toString()).toBe(SCHEMA_COMPOSER);
      expect(plan.files["cortex.schema.ts"]).toEqual(
        fs.readFileSync(path.join(sdk, "convex-dev/schema.ts")),
      );
      expect(plan.files["facts.ts"].toString()).toContain(
        'import { action, internalMutation, internalQuery, mutation, query } from "./sdk.registration"',
      );
      expect(plan.files["cliOperator/factHistory.ts"].toString()).toContain(
        'import type { MutationCtx, QueryCtx } from "../_generated/server"',
      );
      applyBackendPlan(plan);
      const ownership = readManifest(project);
      expect(ownership.sources["facts.ts"]).toMatchObject({
        target: "facts.ts",
        role: "registration-import-v1",
      });
      expect(ownership.sources["facts.ts"].sourceHash).not.toBe(
        ownership.files["facts.ts"],
      );
      expect(ownership.files["app.schema.ts"]).toBeUndefined();
      expect(ownership.files["sdk.registration.ts"]).toBeUndefined();
      for (const name of Object.keys(before))
        if (
          name.endsWith("sentinel") ||
          name.includes("_generated") ||
          name.includes("app/") ||
          /app.schema|sdk.registration|auth.config|crons|convex.json/.test(name)
        )
          expect(tree(project)[name]).toBe(before[name]);
      const installed = tree(project),
        again = planBackendSync(project, sdk);
      expect(again.additions).toEqual([]);
      expect(again.updates).toEqual([]);
      expect(again.conflicts).toEqual([]);
      applyBackendPlan(again);
      expect(tree(project)).toEqual(installed);
      expect(expectedSdkRegistrations()).toHaveLength(488);
      expect(
        expectedSdkRegistrations().every((op) => op.visibility === "internal"),
      ).toBe(true);
      expect(
        expectedSdkRegistrations()
          .filter((op) => op.type === "action")
          .map((op) => `${op.module}:${op.name}`)
          .sort(),
      ).toEqual(["cliOperator/facts:semanticSearch", "cliOperator/memories:search", "facts:semanticSearch", "memories:search", "runtimeMemory:recall", "runtimeMemory:remember"]);
      expect(REGISTRATION_SHIM).toContain("export type { QueryCtx, MutationCtx }");
    },
  );
  it.each(["chat-sdk", "vercel-ai-quickstart"] as const)(
    "binds every private app module for %s and refuses changed or missing handlers before writes",
    (template) => {
      const project = fixture(template),
        plan = planTemplateBackend(project, sdk, template);
      expect(
        expectedAppRegistrations(template).every(
          (op) => op.visibility === "internal",
        ),
      ).toBe(true);
      const modules = expectedAppModules(template);
      expect(modules).toEqual(
        Object.keys(plan.dependencies!)
          .filter((name) => name.startsWith("app/"))
          .map((name) => name.slice(0, -3)),
      );
      if (template === "vercel-ai-quickstart") {
        expect(modules).toContain("app/scope");
        expect(
          expectedAppRegistrations(template).map((op) => op.module),
        ).not.toContain("app/scope");
      }
      const handler = path.join(
          project,
          "backend/functions",
          modules[0] + ".ts",
        ),
        before = tree(project);
      fs.appendFileSync(handler, "\nexport const leak = query({});");
      const changed = tree(project),
        writes = jest.spyOn(fs, "writeFileSync");
      expect(() => planTemplateBackend(project, sdk, template)).toThrow(
        "Canonical app contract changed",
      );
      expect(() => applyBackendPlan(plan)).toThrow();
      expect(writes).not.toHaveBeenCalled();
      expect(tree(project)).toEqual(changed);
      writes.mockRestore();
      fs.unlinkSync(handler);
      const missing = tree(project);
      expect(() => planTemplateBackend(project, sdk, template)).toThrow(
        "Canonical app dependency missing",
      );
      expect(tree(project)).toEqual(missing);
      expect(before).not.toEqual(missing);
    },
  );
  it("preserves raw source bytes, rejects unknown recursive bytes and ignores generated input", () => {
    const raw = discoverBackendFiles(sdk),
      before = Object.fromEntries(
        Object.entries(raw).map(([name, bytes]) => [name, hashBytes(bytes)]),
      );
    const output = transformCanonicalSdk(raw);
    expect(
      Object.fromEntries(
        Object.entries(raw).map(([name, bytes]) => [name, hashBytes(bytes)]),
      ),
    ).toEqual(before);
    expect(output["lib/factHistoryProvenance.ts"]).toEqual(
      raw["lib/factHistoryProvenance.ts"],
    );
    expect(output["lib/domainScope.ts"]).toEqual(raw["lib/domainScope.ts"]);
    expect(output["lib/referenceLifecycle.ts"]).toEqual(
      raw["lib/referenceLifecycle.ts"],
    );
    expect(output["lib/domainScope.ts"].toString()).toContain(
      'import type { QueryCtx } from "../_generated/server"',
    );
    expect(expectedSdkRegistrations().map((op) => op.module)).not.toContain(
      "lib/domainScope",
    );
    expect(expectedSdkRegistrations().map((op) => op.module)).not.toContain(
      "lib/referenceLifecycle",
    );
    expect(expectedSdkRegistrations().map((op) => op.module)).not.toContain(
      "lib/factHistoryProvenance",
    );
    expect(() =>
      transformCanonicalSdk({
        ...raw,
        "http.ts": Buffer.from("export const route = httpAction({});"),
      }),
    ).toThrow("Unreviewed recursive");
    expect(() =>
      transformCanonicalSdk({
        ...raw,
        "facts.ts": Buffer.from(
          raw["facts.ts"].toString().replace("mutation, query", "mutation, query as read"),
        ),
      }),
    ).toThrow("Unreviewed SDK source");
  });
  it.each(["modified", "missing"] as const)(
    "refuses a %s domain helper before template writes",
    (change) => {
      const source = temp();
      for (const [name, bytes] of Object.entries(discoverBackendFiles(sdk))) {
        const file = path.join(source, "convex-dev", name);
        fs.mkdirSync(path.dirname(file), { recursive: true });
        fs.writeFileSync(file, bytes);
      }
      fs.writeFileSync(
        path.join(source, "package.json"),
        JSON.stringify({ name: "@cortexmemory/sdk", version: "0.39.0" }),
      );
      const helper = path.join(source, "convex-dev/lib/domainScope.ts");
      if (change === "modified")
        fs.appendFileSync(helper, "\nexport const leak = query({});\n");
      else fs.unlinkSync(helper);
      const project = fixture(),
        before = tree(project),
        sourceBefore = tree(source),
        write = jest.spyOn(fs, "writeFileSync");
      expect(() => planTemplateBackend(project, source, "chat-sdk")).toThrow(
        change === "modified"
          ? "Unreviewed SDK source"
          : "Unreviewed SDK file/entrypoint set",
      );
      expect(write).not.toHaveBeenCalled();
      expect(tree(project)).toEqual(before);
      expect(tree(source)).toEqual(sourceBefore);
    },
  );
  it.each([
    ["lib/referenceLifecycle.ts", "modified"],
    ["lib/referenceLifecycle.ts", "missing"],
    ["referenceMaintenance.ts", "modified"],
    ["referenceMaintenance.ts", "missing"],
    ["memories.ts", "modified"],
    ["memories.ts", "missing"],
    ["runtimeDataAuth.ts", "modified"],
    ["runtimeDataAuth.ts", "missing"],
    ...["domainErasure.ts", "lib/domainErasureScope.ts", "lib/domainPaging.ts", "lib/graphSync.ts", "lib/memoryVectorScope.ts"].flatMap((name) => [[name, "modified"], [name, "missing"]] as const),
  ] as const)(
    "refuses %s when %s before any template writes",
    (name, change) => {
      const source = temp();
      for (const [file, bytes] of Object.entries(discoverBackendFiles(sdk))) {
        const target = path.join(source, "convex-dev", file);
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.writeFileSync(target, bytes);
      }
      fs.writeFileSync(
        path.join(source, "package.json"),
        JSON.stringify({ name: "@cortexmemory/sdk", version: "0.39.0" }),
      );
      const target = path.join(source, "convex-dev", name);
      if (change === "modified")
        fs.appendFileSync(target, "\nexport const leak = query({});\n");
      else fs.unlinkSync(target);
      const project = fixture(),
        before = tree(project),
        sourceBefore = tree(source),
        write = jest.spyOn(fs, "writeFileSync");
      expect(() => planTemplateBackend(project, source, "chat-sdk")).toThrow(
        change === "modified"
          ? "Unreviewed SDK source"
          : "Unreviewed SDK file/entrypoint set",
      );
      expect(write).not.toHaveBeenCalled();
      expect(tree(project)).toEqual(before);
      expect(tree(source)).toEqual(sourceBefore);
    },
  );
  it("retains internal maintenance and operator registrations with the Basic raw layout", () => {
    const maintenance = expectedSdkRegistrations().filter(
      (operation) => operation.module === "referenceMaintenance",
    );
    expect(maintenance).toEqual([
      ...["status", "planPage"].map((name) => ({
        module: "referenceMaintenance",
        name,
        type: "query",
        visibility: "internal",
      })),
      ...[
        "startGeneration",
        "advanceBackfill",
        "beginFinalization",
        "advanceValidation",
        "activateGeneration",
        "abortFinalization",
      ].map((name) => ({
        module: "referenceMaintenance",
        name,
        type: "mutation",
        visibility: "internal",
      })),
    ]);
    expect(expectedSdkRegistrations()).toEqual(expect.arrayContaining([
      { module: "cliOperator/memories", name: "domainPage", type: "query", visibility: "internal" },
      { module: "cliOperator/conversations", name: "domainPage", type: "query", visibility: "internal" },
      { module: "cliOperator/facts", name: "candidatePage", type: "query", visibility: "internal" },
      { module: "cliOperator/immutable", name: "get", type: "query", visibility: "internal" },
      { module: "cliOperator/memorySpaces", name: "list", type: "query", visibility: "internal" },
      { module: "cliOperator/factHistory", name: "getOperationReceipt", type: "query", visibility: "internal" },
      { module: "cliOperator/graphSync", name: "getGraphJob", type: "query", visibility: "internal" },
    ]));
    const project = temp(),
      raw = discoverBackendFiles(sdk);
    const plan = planBackendSync(project, sdk);
    expect(plan.ownership.format).toBe(1);
    expect(plan.files).toEqual(raw);
    expect(plan.files["memories.ts"].toString()).toContain(
      "./_generated/server",
    );
    expect(plan.files["referenceMaintenance.ts"].toString()).toContain(
      'import { internalMutation, internalQuery } from "./_generated/server"',
    );
    for (const name of [
      "cortexReferenceTargets",
      "cortexReferenceEdges",
      "cortexReferenceState",
    ])
      expect(raw["schema.ts"].toString()).toContain(`${name}: defineTable({`);
    applyBackendPlan(plan);
    for (const [name, bytes] of Object.entries(raw))
      expect(fs.readFileSync(path.join(project, "convex", name))).toEqual(
        bytes,
      );
  });
  it("retains mixed aliases and separate type imports with only module-string changes", () => {
    const mixed =
      'import { query as read, type QueryCtx as ReadCtx, type MutationCtx as WriteCtx } from "./_generated/server";';
    expect(rewriteRegistrationImport(mixed, "facts.ts")).toBe(
      mixed.replace("./_generated/server", "./sdk.registration"),
    );
    expect(
      rewriteRegistrationImport(
        'import { internalQuery as read } from "../_generated/server";',
        "lib/functions.ts",
      ),
    ).toBe('import { internalQuery as read } from "../sdk.registration";');
    const separate =
      'import type { MutationCtx, QueryCtx } from "./_generated/server";';
    expect(rewriteRegistrationImport(separate, "facts.ts")).toBe(separate);
  });
  it.each(["alias", "helper", "origin", "body"] as const)(
    "refuses an unreviewed %s change to the admin lifecycle hook before writes",
    (change) => {
      const source = temp();
      for (const [name, bytes] of Object.entries(discoverBackendFiles(sdk))) {
        const target = path.join(source, "convex-dev", name);
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.writeFileSync(target, bytes);
      }
      fs.writeFileSync(
        path.join(source, "package.json"),
        JSON.stringify({ name: "@cortexmemory/sdk", version: "0.39.0" }),
      );
      const target = path.join(source, "convex-dev/admin.ts");
      let text = fs.readFileSync(target, "utf8");
      if (change === "alias")
        text = text.replace(
          "deleteMaintenanceRecord, maintenanceTable",
          "deleteMaintenanceRecord as remove, maintenanceTable",
        );
      else if (change === "helper")
        text = text.replace("deleteMaintenanceRecord, maintenanceTable", "unreviewedDeletion, maintenanceTable");
      else if (change === "origin")
        text = text.replace("./runtimeWorkerAuth", "./lib/unreviewed");
      else text += "\n// different writer body\n";
      fs.writeFileSync(target, text);
      const project = fixture(),
        before = tree(project),
        write = jest.spyOn(fs, "writeFileSync");
      expect(() => planBackendSync(project, source)).toThrow(
        "SDK fixed internal-admin registration binding rejected",
      );
      expect(write).not.toHaveBeenCalled();
      expect(tree(project)).toEqual(before);
    },
  );
  it("keeps modified prior-epoch outputs protected and refuses unknown epochs", () => {
    const priorHash =
      "4a5508eb1b201cfcf2a6c28c20e097f8c9b7e3f4e1383e927fc5b005a70dde13";
    expect(isRecognizedTransformContractHash(priorHash)).toBe(true);
    expect(isRecognizedTransformContractHash("fb9cfabf73451e3c4116724515ae2a7b319682acd761168b1d1abaa613bffc5d")).toBe(true);
    expect(
      isRecognizedTransformContractHash(
        "c3f2c351ad8e8691254d804aec6ef872848f90d3dfbea058d4ded189b920783f",
      ),
    ).toBe(true);
    for (const unknown of ["0".repeat(64), null, {}, priorHash.toUpperCase()])
      expect(isRecognizedTransformContractHash(unknown)).toBe(false);
    const project = fixture();
    applyBackendPlan(planTemplateBackend(project, sdk, "chat-sdk"));
    const old = readManifest(project);
    old.layout.contractHash = priorHash;
    saveManifest(project, old);
    fs.appendFileSync(
      path.join(project, "backend/functions/memories.ts"),
      "\n// user modification\n",
    );
    const before = tree(project),
      plan = planBackendSync(project, sdk),
      write = jest.spyOn(fs, "writeFileSync");
    expect(plan.conflicts).toContain("memories.ts");
    expect(() => applyBackendPlan(plan, { overwrite: true })).toThrow(
      "Backend conflicts",
    );
    expect(write).not.toHaveBeenCalled();
    expect(tree(project)).toEqual(before);
  });
  it.each([
    'import { query, MutationCtx } from "./_generated/server";',
    'import { query, type UnknownCtx } from "./_generated/server";',
    'import { query as read, mutation as read } from "./_generated/server";',
    'import * as server from "./_generated/server";',
    'import { httpAction } from "./_generated/server";',
    'import { query } from "convex/server";',
    'import { query } from "./_generated/server"; import("evil");',
  ])("refuses unknown import %s", (statement) =>
    expect(() => rewriteRegistrationImport(statement, "facts.ts")).toThrow(),
  );
  it.each([
    ["chat-sdk", "7220fc2a4de7fe4b05cef054588d92c036c0570b0abcdec6974b4e36f833bf30"],
    ["vercel-ai-quickstart", "eac517966add9aedc500747e239f6be2607003393e270ed7f8242575ba9c01d0"],
  ] as const)("admits only exact prior %s app epoch and requires the current template shim", (template, prior) => {
    expect(isRecognizedAppContractHash(template, prior)).toBe(true);
    expect(isRecognizedAppContractHash(template, appContractHash(template))).toBe(true);
    for (const invalid of ["0".repeat(64), prior.toUpperCase(), null, {}])
      expect(isRecognizedAppContractHash(template, invalid)).toBe(false);
    expect(isRecognizedAppContractHash("basic", prior)).toBe(false);
    const project = fixture(template);
    applyBackendPlan(planTemplateBackend(project, sdk, template));
    const old = readManifest(project);
    old.layout.appContractHash = prior;
    saveManifest(project, old);
    fs.writeFileSync(path.join(project, "backend/functions/sdk.registration.ts"), REGISTRATION_SHIM.replace("QueryCtx, MutationCtx", "QueryCtx"));
    const before = tree(project), write = jest.spyOn(fs, "writeFileSync");
    expect(() => planBackendSync(project, sdk)).toThrow("Canonical app contract changed: sdk.registration.ts");
    expect(write).not.toHaveBeenCalled();
    expect(tree(project)).toEqual(before);
  });
  it("I181 migrates the exact prior Chat app epoch only after explicit intact template update", () => {
    const project = fixture("chat-sdk"), previousHash = "84b569cf43f082f128df8e4d548f68342f9a69094e8c89de3311fbcfbeb8b13e";
    expect(isRecognizedAppContractHash("chat-sdk", previousHash)).toBe(true);
    expect(isRecognizedAppContractHash("vercel-ai-quickstart", previousHash)).toBe(false);
    applyBackendPlan(planTemplateBackend(project, sdk, "chat-sdk"));
    const old = readManifest(project), file = path.join(project, "backend/functions/app/chatData.ts"), current = fs.readFileSync(file, "utf8");
    const prior = current.replaceAll("args.versions[args.versions.length - 1]", "args.versions.at(-1)");
    expect(hashBytes(prior)).toBe("1f7637bdbfe014ceed2d1880bf67f288af911f8eefcd1a932c25bcd43709cf18");
    old.layout.appContractHash = previousHash; saveManifest(project, old); fs.writeFileSync(file, prior);
    const unchanged = tree(project);
    expect(() => planBackendSync(project, sdk)).toThrow("Canonical app contract changed: app/chatData.ts");
    expect(tree(project)).toEqual(unchanged);
    // The independent template update supplies the exact new app source before SDK synchronization.
    fs.writeFileSync(file, current);
    const before = tree(project), plan = planBackendSync(project, sdk);
    expect(plan.conflicts).toEqual([]); expect(plan.updates).toEqual([]);
    expect(plan.ownership.format).toBe(2);
    expect((plan.ownership as ComposedBackendOwnership).layout.appContractHash).toBe(appContractHash("chat-sdk"));
    applyBackendPlan(plan, { dryRun: true }); expect(tree(project)).toEqual(before);
    applyBackendPlan(plan); expect(readManifest(project).layout.appContractHash).toBe(appContractHash("chat-sdk"));
    const installed = tree(project); applyBackendPlan(planBackendSync(project, sdk)); expect(tree(project)).toEqual(installed);
    const unknown = readManifest(project); unknown.layout.appContractHash = "0".repeat(64); saveManifest(project, unknown);
    const badManifest = tree(project); expect(() => planBackendSync(project, sdk)).toThrow(); expect(tree(project)).toEqual(badManifest);
    unknown.layout.appContractHash = previousHash; saveManifest(project, unknown);
    fs.appendFileSync(path.join(project, "backend/functions/schema.ts"), "\n// user edited schema\n");
    const edited = tree(project), conflict = planBackendSync(project, sdk);
    expect(conflict.conflicts).toContain("schema.ts"); expect(() => applyBackendPlan(conflict, { overwrite: true })).toThrow("Backend conflicts"); expect(tree(project)).toEqual(edited);
  });
  it("dry-run is zero-write, and rollback restores every managed target", () => {
    const project = fixture(),
      before = tree(project),
      plan = planTemplateBackend(project, sdk, "chat-sdk");
    applyBackendPlan(plan, { dryRun: true });
    expect(tree(project)).toEqual(before);
    const rename = fs.renameSync;
    let calls = 0;
    jest.spyOn(fs, "renameSync").mockImplementation((from, to) => {
      if (++calls === 3) throw new Error("injected disk failure");
      rename(from, to);
    });
    expect(() => applyBackendPlan(plan)).toThrow("injected disk failure");
    expect(tree(project)).toEqual(before);
  });
  it.each(["shim", "schema", "config", "manifest"])(
    "refuses %s race before writes",
    (change) => {
      const project = fixture(),
        plan = planTemplateBackend(project, sdk, "chat-sdk");
      const file =
        change === "shim"
          ? "backend/functions/sdk.registration.ts"
          : change === "schema"
            ? "backend/functions/app.schema.ts"
            : change === "config"
              ? "convex.json"
              : BACKEND_MANIFEST;
      fs.mkdirSync(path.dirname(path.join(project, file)), { recursive: true });
      fs.writeFileSync(path.join(project, file), "raced bytes");
      const before = tree(project),
        write = jest.spyOn(fs, "writeFileSync");
      expect(() => applyBackendPlan(plan)).toThrow("changed since preflight");
      expect(write).not.toHaveBeenCalled();
      expect(tree(project)).toEqual(before);
    },
  );
  it.each(["chat-sdk", "vercel-ai-quickstart"] as const)(
    "migrates only the exact reviewed old composer ledger for %s and stays idempotent",
    (template) => {
      const project = fixture(template);
      applyBackendPlan(planTemplateBackend(project, sdk, template));
      const previous = SCHEMA_COMPOSER.replace(
        "Object.prototype.hasOwnProperty.call(appSchema.tables, name)",
        "Object.hasOwn(appSchema.tables, name)",
      );
      const oldHash = "747591d346a34e72a347b6bcf7742c206c9e6cf232f61ec267f47730c26b7438";
      expect(hashBytes(previous)).toBe(oldHash);
      expect(isRecognizedSchemaComposerHash(oldHash)).toBe(true);
      expect(isRecognizedSchemaComposerHash(hashBytes(SCHEMA_COMPOSER))).toBe(true);
      fs.writeFileSync(path.join(project, "backend/functions/schema.ts"), previous);
      const old = readManifest(project);
      old.files["schema.ts"] = oldHash;
      saveManifest(project, old);
      const before = tree(project);
      const plan = planBackendSync(project, sdk);
      expect(plan.conflicts).toEqual([]);
      expect(plan.updates).toEqual(["schema.ts"]);
      applyBackendPlan(plan, { dryRun: true });
      expect(tree(project)).toEqual(before);
      applyBackendPlan(plan);
      expect(fs.readFileSync(path.join(project, "backend/functions/schema.ts"), "utf8")).toBe(SCHEMA_COMPOSER);
      expect(readManifest(project).layout).toEqual(old.layout);
      expect(readManifest(project).files["schema.ts"]).toBe(hashBytes(SCHEMA_COMPOSER));
      const current = tree(project);
      const again = planBackendSync(project, sdk);
      expect(again.updates).toEqual([]);
      expect(again.conflicts).toEqual([]);
      applyBackendPlan(again);
      expect(tree(project)).toEqual(current);
    },
  );
  it.each(["unknown-ledger", "edited-old-schema"] as const)(
    "refuses %s before migration writes",
    (change) => {
      const project = fixture();
      applyBackendPlan(planTemplateBackend(project, sdk, "chat-sdk"));
      const previous = SCHEMA_COMPOSER.replace(
        "Object.prototype.hasOwnProperty.call(appSchema.tables, name)",
        "Object.hasOwn(appSchema.tables, name)",
      );
      const bytes = previous + (change === "unknown-ledger" ? "\n// unknown composer\n" : "");
      fs.writeFileSync(path.join(project, "backend/functions/schema.ts"), bytes);
      const old = readManifest(project);
      old.files["schema.ts"] = hashBytes(bytes);
      saveManifest(project, old);
      if (change === "edited-old-schema") fs.appendFileSync(path.join(project, "backend/functions/schema.ts"), "\n// user edit\n");
      const before = tree(project);
      if (change === "unknown-ledger") {
        expect(isRecognizedSchemaComposerHash(old.files["schema.ts"])).toBe(false);
        expect(() => planBackendSync(project, sdk)).toThrow();
      } else {
        const plan = planBackendSync(project, sdk);
        expect(plan.conflicts).toEqual(["schema.ts"]);
        expect(() => applyBackendPlan(plan, { overwrite: true })).toThrow("Backend conflicts");
      }
      expect(tree(project)).toEqual(before);
    },
  );
  it("allows app schema edits without SDK ownership, and detects modified composer/helper/retired outputs", () => {
    const project = fixture();
    applyBackendPlan(planTemplateBackend(project, sdk, "chat-sdk"));
    fs.appendFileSync(
      path.join(project, "backend/functions/app.schema.ts"),
      "\n// legitimate app edit\n",
    );
    expect(planBackendSync(project, sdk).conflicts).toEqual([]);
    fs.appendFileSync(
      path.join(project, "backend/functions/schema.ts"),
      "\n// composer drift\n",
    );
    fs.appendFileSync(
      path.join(project, "backend/functions/lib/userDataScope.ts"),
      "\n// helper drift\n",
    );
    const plan = planBackendSync(project, sdk);
    expect(plan.conflicts).toEqual(["lib/userDataScope.ts", "schema.ts"]);
    expect(() => applyBackendPlan(plan, { overwrite: true })).toThrow(
      "Backend conflicts",
    );
  });
  it("keeps prior/new provenance independent across additions, changes, retirement and reintroduction", () => {
    const project = fixture();
    applyBackendPlan(planTemplateBackend(project, sdk, "chat-sdk"));
    const old = readManifest(project),
      dir = path.join(project, "backend/functions"),
      bytes = Buffer.from("// previous approved fixture module\n"),
      hash = hashBytes(bytes);
    old.layout.contractHash =
      "4a5508eb1b201cfcf2a6c28c20e097f8c9b7e3f4e1383e927fc5b005a70dde13";
    expect(isRecognizedTransformContractHash(old.layout.contractHash)).toBe(
      true,
    );
    // Represent an already installed prior ledger; no new candidate gains trust from these records.
    fs.writeFileSync(path.join(dir, "memories.ts"), bytes);
    old.sources["memories.ts"] = {
      target: "memories.ts",
      sourceHash: hash,
      outputHash: hash,
      role: "unchanged",
    };
    old.files["memories.ts"] = hash;
    fs.writeFileSync(path.join(dir, "lib/removed.ts"), bytes);
    old.sources["lib/removed.ts"] = {
      target: "lib/removed.ts",
      sourceHash: hash,
      outputHash: hash,
      role: "unchanged",
    };
    old.files["lib/removed.ts"] = hash;
    delete old.sources["lib/userDataScope.ts"];
    delete old.files["lib/userDataScope.ts"];
    fs.unlinkSync(path.join(dir, "lib/userDataScope.ts"));
    saveManifest(project, old);
    const plan = planBackendSync(project, sdk);
    expect(plan.conflicts).toEqual([]);
    expect(plan.updates).toContain("memories.ts");
    expect(plan.additions).toContain("lib/userDataScope.ts");
    expect(plan.ownership.sdk.sourceHash).not.toBe(old.sdk.sourceHash);
    applyBackendPlan(plan);
    const current = readManifest(project);
    expect(current.layout.contractHash).toBe(TRANSFORM_CONTRACT_HASH);
    expect(planBackendSync(project, sdk).updates).toEqual([]);
    expect(current.retired["lib/removed.ts"]).toMatchObject({
      sdk: old.sdk,
      sourceHash: hash,
      outputHash: hash,
      disposition: "preserve-owned-no-delete",
    });
    expect(fs.readFileSync(path.join(dir, "lib/removed.ts"))).toEqual(bytes);
    const reintroduced = current.sources["lib/userDataScope.ts"];
    if (!("target" in reintroduced)) throw new Error("expected mapped helper");
    current.retired["lib/userDataScope.ts"] = {
      sdk: { ...current.sdk },
      target: reintroduced.target,
      sourceHash: reintroduced.sourceHash,
      outputHash: reintroduced.outputHash,
      disposition: "preserve-owned-no-delete",
    };
    delete current.sources["lib/userDataScope.ts"];
    saveManifest(project, current);
    applyBackendPlan(planBackendSync(project, sdk));
    expect(
      readManifest(project).retired["lib/userDataScope.ts"],
    ).toBeUndefined();
    fs.appendFileSync(path.join(dir, "lib/removed.ts"), "drift");
    expect(planBackendSync(project, sdk).conflicts).toContain("lib/removed.ts");
  });
  it("refuses unknown wrappers, collisions, paths, shim changes and legacy Vercel with exact preservation", () => {
    for (const kind of [
      "wrapper",
      "collision",
      "shim",
      "path",
      "legacy",
      "authIndirect",
      "cronComponent",
    ] as const) {
      const project = fixture(
        kind === "legacy" ? "vercel-ai-quickstart" : "chat-sdk",
      );
      if (kind === "path")
        fs.writeFileSync(
          path.join(project, "convex.json"),
          '{"functions":"../escape"}',
        );
      else if (kind === "legacy") {
        fs.mkdirSync(path.join(project, ".convex"));
      } else if (kind === "authIndirect")
        fs.writeFileSync(
          path.join(project, "backend/functions/auth.config.ts"),
          'import { query as register } from "./_generated/server"; export const leak = register({});',
        );
      else if (kind === "cronComponent")
        fs.writeFileSync(
          path.join(project, "backend/functions/crons.ts"),
          'import { defineComponent as register } from "convex/server"; export default register("leak");',
        );
      else {
        fs.mkdirSync(path.join(project, "backend/functions/app"), {
          recursive: true,
        });
        fs.writeFileSync(
          path.join(
            project,
            "backend/functions",
            kind === "shim"
              ? "sdk.registration.ts"
              : kind === "collision"
                ? "facts.ts"
                : "app/extra.ts",
          ),
          "export const leak = query({});",
        );
      }
      const before = tree(project),
        write = jest.spyOn(fs, "writeFileSync");
      if (kind === "collision") {
        const plan = planTemplateBackend(project, sdk, "chat-sdk");
        expect(plan.conflicts).toContain("facts.ts");
        expect(() => applyBackendPlan(plan, { overwrite: true })).toThrow(
          "Backend conflicts",
        );
      } else
        expect(() =>
          planTemplateBackend(
            project,
            sdk,
            kind === "legacy" ? "vercel-ai-quickstart" : "chat-sdk",
          ),
        ).toThrow();
      expect(write).not.toHaveBeenCalled();
      expect(tree(project)).toEqual(before);
      jest.restoreAllMocks();
    }
  });
  it("rejects unexpected SDK JavaScript and source/module-set races before apply writes", () => {
    const source = temp();
    fs.mkdirSync(path.join(source, "convex-dev"));
    for (const [name, bytes] of Object.entries(discoverBackendFiles(sdk))) {
      const file = path.join(source, "convex-dev", name);
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, bytes);
    }
    fs.writeFileSync(
      path.join(source, "package.json"),
      JSON.stringify({ name: "@cortexmemory/sdk", version: "0.39.0" }),
    );
    const project = fixture(),
      plan = planTemplateBackend(project, source, "chat-sdk");
    fs.writeFileSync(
      path.join(source, "convex-dev/http.js"),
      "export const route = httpAction({});",
    );
    const before = tree(project),
      write = jest.spyOn(fs, "writeFileSync");
    expect(() => planTemplateBackend(project, source, "chat-sdk")).toThrow(
      "Unreviewed SDK file/entrypoint set",
    );
    expect(() => applyBackendPlan(plan)).toThrow(
      "Unreviewed SDK file/entrypoint set",
    );
    expect(write).not.toHaveBeenCalled();
    expect(tree(project)).toEqual(before);
    jest.restoreAllMocks();
    fs.unlinkSync(path.join(source, "convex-dev/http.js"));
    fs.appendFileSync(
      path.join(source, "convex-dev/facts.ts"),
      "\n// changed after preflight\n",
    );
    expect(() => applyBackendPlan(plan)).toThrow(
      "SDK source changed since preflight",
    );
    fs.writeFileSync(
      path.join(project, "backend/functions/http.js"),
      "export const route = httpAction({});",
    );
    expect(() => applyBackendPlan(plan)).toThrow(
      "Backend entrypoint set changed since preflight",
    );
    expect(tree(project)[".cortex/"]).toBeUndefined();
  });
  it("explicitly converts unchanged recognized Chat format1 without arbitrary merge", () => {
    const project = temp();
    applyBackendPlan(planBackendSync(project, sdk));
    const canonical = path.join(
      core,
      "packages/cortex-templates/payloads/chat-sdk/1.2.0/convex",
    );
    fs.cpSync(canonical, path.join(project, "convex"), {
      recursive: true,
      filter: (file) =>
        !file.split(path.sep).includes("_generated") &&
        !["schema.ts", "tsconfig.json"].includes(path.basename(file)),
    });
    const before = fs.readFileSync(path.join(project, "convex/schema.ts"));
    const plan = planTemplateBackend(project, sdk, "chat-sdk");
    expect(plan.conflicts).toEqual([]);
    expect(plan.updates).toContain("schema.ts");
    applyBackendPlan(plan);
    expect(readManifest(project).format).toBe(2);
    expect(
      fs.readFileSync(path.join(project, "convex/cortex.schema.ts")),
    ).toEqual(before);
  });
  it.each([
    "extra",
    "mapping",
    "sourceHash",
    "outputHash",
    "retired",
    "configDisposition",
    "contractHash",
  ])("rejects forged %s ledger before writes", (kind) => {
    const project = fixture();
    applyBackendPlan(planTemplateBackend(project, sdk, "chat-sdk"));
    const manifest = readManifest(project);
    if (kind === "extra") Object.assign(manifest, { unknown: true });
    else if (kind === "mapping" && "target" in manifest.sources["facts.ts"])
      manifest.sources["facts.ts"].target = "../escape";
    else if (kind === "sourceHash") manifest.sdk.sourceHash = "0".repeat(64);
    else if (kind === "outputHash") manifest.outputHash = "0".repeat(64);
    else if (kind === "retired")
      manifest.retired["../escape.ts"] = {
        sdk: manifest.sdk,
        target: "../escape.ts",
        sourceHash: "0".repeat(64),
        outputHash: "0".repeat(64),
        disposition: "preserve-owned-no-delete",
      };
    else if (kind === "contractHash")
      manifest.layout.contractHash = "0".repeat(64);
    else Object.assign(manifest.layout, { configDisposition: "unknown" });
    fs.writeFileSync(
      path.join(project, BACKEND_MANIFEST),
      JSON.stringify(manifest),
    );
    const before = tree(project),
      write = jest.spyOn(fs, "writeFileSync");
    expect(() => planBackendSync(project, sdk)).toThrow();
    expect(write).not.toHaveBeenCalled();
    expect(tree(project)).toEqual(before);
  });
});
