/** Actual Convex registrations: scope arguments must never make raw admin public. */
import * as admin from "../../convex-dev/admin";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { ValidatorJSON } from "convex/values";

const tables = [
  "agents", "artifacts", "contexts", "conversations", "factHistory", "facts",
  "governanceEnforcement", "governancePolicies", "graphSyncQueue", "immutable",
  "memories", "memorySpaces", "mutable", "sessions",
];

// Convex omits this runtime registration hook from its published public types.
function argsValidator(registration: unknown): ValidatorJSON {
  if (!registration || typeof registration !== "function" ||
      !("exportArgs" in registration) || typeof registration.exportArgs !== "function") {
    throw new Error("Convex registration is missing exportArgs");
  }
  return JSON.parse((registration.exportArgs as () => string)()) as ValidatorJSON;
}

const queries = ["listTable", "countTable", "getAllCounts"] as const;
const mutations = ["deleteRecord", "clearTable"] as const;

describe("raw administration registration boundary", () => {
  it("contains exactly the reviewed maintenance functions", () => {
    expect(Object.keys(admin).sort()).toEqual([...queries, ...mutations].sort());
  });

  it.each([...queries, ...mutations])("%s is internal and never public", (name) => {
    const registration = admin[name];
    expect(registration.isInternal).toBe(true);
    expect(registration).not.toHaveProperty("isPublic");
    expect(registration).toHaveProperty(
      queries.includes(name as typeof queries[number]) ? "isQuery" : "isMutation",
      true,
    );
  });

  it.each([...queries, ...mutations])("%s has no client privilege or tenant override", (name) => {
    const validator = argsValidator(admin[name]);
    expect(validator.type).toBe("object");
    if (validator.type !== "object") throw new Error("Expected object validator");
    const expected = name === "getAllCounts" ? [] :
      name === "deleteRecord" ? ["id", "table"] :
      name === "countTable" ? ["table"] : ["limit", "table"];
    expect(Object.keys(validator.value).sort()).toEqual(expected);
  });

  it.each(["listTable", "countTable", "deleteRecord", "clearTable"] as const)(
    "%s retains its table allowlist and excludes arbitrary tables", (name) => {
      const validator = argsValidator(admin[name]);
      if (validator.type !== "object") throw new Error("Expected object validator");
      expect(validator.value.table).toEqual({
        fieldType: { type: "union", value: tables.map((value) => ({ type: "literal", value })) },
        optional: false,
      });
    },
  );

  it("retains the delete ID allowlist", () => {
    const validator = argsValidator(admin.deleteRecord);
    if (validator.type !== "object") throw new Error("Expected object validator");
    expect(validator.value.id).toEqual({
      fieldType: { type: "union", value: tables.map((tableName) => ({ type: "id", tableName })) },
      optional: false,
    });
  });

  it.each(["listTable", "clearTable"] as const)("%s retains optional numeric limit", (name) => {
    const validator = argsValidator(admin[name]);
    if (validator.type !== "object") throw new Error("Expected object validator");
    expect(validator.value.limit).toEqual({ fieldType: { type: "number" }, optional: true });
  });
});

describe("retired sweeping scripts", () => {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
  it.each(["cleanup-test-data.ts", "test-memory-openai-20x.mjs"])(
    "%s rejects legacy targets and does not read configuration", (script) => {
      const fixture = mkdtempSync(resolve(tmpdir(), "cortex-admin-retired-"));
      try {
        // Parsing this as dotenv would leak the sentinel through the old target banner.
        const secret = "task00-private-sentinel";
        const url = "http://127.0.0.1:1";
        writeFileSync(resolve(fixture, ".env.local"), `CONVEX_URL=${url}/${secret}\n`);
        const scriptPath = resolve(root, "scripts", script);
        const args = script.endsWith(".ts")
          ? [resolve(root, "node_modules/tsx/dist/cli.mjs"), scriptPath, url, "--admin", "--yes"]
          : [scriptPath, url, "--admin", "--yes"];
        const result = spawnSync(process.execPath, args, {
          cwd: fixture,
          env: { PATH: process.env.PATH, HOME: fixture, CONVEX_URL: `${url}/${secret}`, CONVEX_DEPLOY_KEY: secret },
          encoding: "utf8", timeout: 10000,
        });
        expect(result.error).toBeUndefined();
        expect(result.status).toBe(1);
        expect(result.stdout).toBe("");
        expect(result.stderr).toContain("is retired");
        expect(result.stderr).toContain("Documentation/security/admin-operations.mdx");
        expect(result.stderr).not.toContain(secret);
        expect(result.stderr).not.toContain(url);
      } finally {
        rmSync(fixture, { recursive: true, force: true });
      }
    },
  );
});
